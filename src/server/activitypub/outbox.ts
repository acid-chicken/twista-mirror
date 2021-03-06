import { ObjectID } from 'mongodb';
import * as Router from 'koa-router';
import config from '../../config';
import $ from 'cafy';
import ID, { transform } from '../../misc/cafy-id';
import User, { IUser } from '../../models/user';
import { renderActivity } from '../../remote/activitypub/renderer';
import renderOrderedCollection from '../../remote/activitypub/renderer/ordered-collection';
import renderOrderedCollectionPage from '../../remote/activitypub/renderer/ordered-collection-page';
import { setResponseType } from '../activitypub';

import Note, { INote } from '../../models/note';
import renderNote from '../../remote/activitypub/renderer/note';
import renderCreate from '../../remote/activitypub/renderer/create';
import renderAnnounce from '../../remote/activitypub/renderer/announce';
import { countIf } from '../../prelude/array';
import * as url from '../../prelude/url';

const middleware = async (ctx: Router.IRouterContext) => {
	if (!ObjectID.isValid(ctx.params.user)) {
		ctx.status = 404;
		return;
	}

	const userId = new ObjectID(ctx.params.user);

	// Get 'sinceId' parameter
	const [sinceId, sinceIdErr] = $.optional.type(ID).get(ctx.request.query.since_id);

	// Get 'untilId' parameter
	const [untilId, untilIdErr] = $.optional.type(ID).get(ctx.request.query.until_id);

	// Get 'page' parameter
	const pageErr = !$.optional.str.or(['true', 'false']).ok(ctx.request.query.page);
	const page: boolean = ctx.request.query.page === 'true';

	// Validate parameters
	if (sinceIdErr || untilIdErr || pageErr || countIf(x => x != null, [sinceId, untilId]) > 1) {
		ctx.status = 400;
		return;
	}

	// Verify user
	const user = await User.findOne({
		_id: userId,
		isDeleted: { $ne: true },
		isSuspended: { $ne: true },
		noFederation: { $ne: true },
		host: null
	});

	if (user === null) {
		ctx.status = 404;
		return;
	}

	const isEveryone = user.usernameLower === 'everyone';
	const everyone = isEveryone ? await User.findOne({
		usernameLower: 'everyone',
		host: null
	}) : undefined;
	const limit = 20;
	const partOf = `${config.url}/users/${userId}/outbox`;

	if (page) {
		//#region Construct query
		const sort = {
			_id: -1
		};

		const query = {
			localOnly: { $ne: true },
			...(isEveryone ? {
				'_user.host': null,
				visibility: 'public'
			} : {
				userId: user._id,
				visibility: { $in: ['public', 'home'] }
			})
		} as any;

		if (sinceId) {
			sort._id = 1;
			query._id = {
				$gt: transform(sinceId)
			};
		} else if (untilId) {
			query._id = {
				$lt: transform(untilId)
			};
		}
		//#endregion

		const notes = await Note
			.find(query, {
				limit: limit,
				sort: sort
			});

		if (sinceId) notes.reverse();

		const activities = await Promise.all(notes.map(note => packActivity(note, everyone)));
		const rendered = renderOrderedCollectionPage(
			`${partOf}?${url.query({
				page: 'true',
				since_id: sinceId,
				until_id: untilId
			})}`,
			user.notesCount, activities, partOf,
			notes.length ? `${partOf}?${url.query({
				page: 'true',
				since_id: notes[0]._id.toHexString()
			})}` : null,
			notes.length ? `${partOf}?${url.query({
				page: 'true',
				until_id: notes[notes.length - 1]._id.toHexString()
			})}` : null
		);

		ctx.body = renderActivity(rendered);
		ctx.set('Cache-Control', 'private, max-age=0, must-revalidate');
		setResponseType(ctx);
	} else {
		// index page
		const rendered = renderOrderedCollection(partOf, user.notesCount,
			`${partOf}?page=true`,
			`${partOf}?page=true&since_id=000000000000000000000000`
		);
		ctx.body = renderActivity(rendered);
		ctx.set('Cache-Control', 'private, max-age=0, must-revalidate');
		setResponseType(ctx);
	}
};

export default middleware;

/**
 * Pack Create<Note> or Announce Activity
 * @param note Note
 */
export async function packActivity(note: INote, announcer?: IUser): Promise<object> {
	if (announcer) {
		const overwriter = {
			userId: announcer._id,
			isEveryone: true
		};

		const renote = note.renoteId && !note.text && !note.poll && (!note.fileIds || !note.fileIds.length) &&
			await Note.findOne({ _id: note.renoteId });

		return renderAnnounce(note.uri || `${config.url}/notes/${(renote && renote.uri.startsWith('https://twitter.com/i/web/status/') && renote || note)._id}`, { ...note, ...overwriter });
	}

	if (note.renoteId && !note.text && !note.poll && (!note.fileIds || !note.fileIds.length)) {
		const renote = await Note.findOne(note.renoteId);
		return renderAnnounce(renote.uri || `${config.url}/notes/${renote._id}`, note);
	}

	return renderCreate(await renderNote(note, false), note);
}
