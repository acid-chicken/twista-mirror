import $ from 'cafy';
import define from '../../define';
import config from '../../../../config';
import * as mongo from 'mongodb';
import User, { pack as packUser, IUser, ILocalUser } from '../../../../models/user';
import { createPerson } from '../../../../remote/activitypub/models/person';
import Note, { pack as packNote, INote } from '../../../../models/note';
import { createNote } from '../../../../remote/activitypub/models/note';
import Resolver from '../../../../remote/activitypub/resolver';
import { ApiError } from '../../error';
import Instance from '../../../../models/instance';
import { extractDbHost } from '../../../../misc/convert-host';
import { validActor, validDocument } from '../../../../remote/activitypub/type';
import { createNoteFromTwitter, createUserFromTwitter } from '../../../../remote/external/twitter';
import { tryCreateUrl } from '../../../../prelude/url';

export const meta = {
	tags: ['federation'],

	desc: {
		'ja-JP': 'URIを指定してActivityPubオブジェクトを参照します。'
	},

	requireCredential: false,

	params: {
		uri: {
			validator: $.str,
			desc: {
				'ja-JP': 'ActivityPubオブジェクトのURI'
			}
		},
	},

	errors: {
		noSuchObject: {
			message: 'No such object.',
			code: 'NO_SUCH_OBJECT',
			id: 'dc94d745-1262-4e63-a17d-fecaa57efc82'
		}
	}
};

export default define(meta, async (ps, user) => {
	const object = await fetchAny(ps.uri, user);
	if (object) {
		return object;
	} else {
		throw new ApiError(meta.errors.noSuchObject);
	}
});

/***
 * URIからUserかNoteを解決する
 */
export async function fetchAny(uri: string, user: ILocalUser) {
	const url = tryCreateUrl(uri);

	// URIがこのサーバーを指しているなら、ローカルユーザーIDとしてDBからフェッチ
	if (uri.startsWith(config.url + '/')) {
		const id = new mongo.ObjectID(uri.split('/').pop());
		const [user, note] = await Promise.all([
			User.findOne({ _id: id }),
			Note.findOne({ _id: id })
		]);

		const packed = await mergePack(user, note);
		if (packed !== null) return packed;
	}

	// ブロックしてたら中断
	const instance = await Instance.findOne({ host: extractDbHost(uri) });
	if (instance && instance.isBlocked) return null;

	// URI(AP Object id)としてDB検索
	{
		const [user, note] = await Promise.all([
			User.findOne({ uri }),
			Note.findOne({ uri })
		]);

		const packed = await mergePack(user, note);
		if (packed !== null) return packed;
	}

	// リモートから一旦オブジェクトフェッチ
	const resolver = new Resolver({ twitter: user.twitter });
	const object = await resolver.resolve(uri).catch(() => null);

	if (object) {
		// /@user のような正規id以外で取得できるURIが指定されていた場合、ここで初めて正規URIが確定する
		// これはDBに存在する可能性があるため再度DB検索
		if (uri !== object.id) {
			if (object.id.startsWith(config.url + '/')) {
				const id = new mongo.ObjectID(object.id.split('/').pop());
				const [user, note] = await Promise.all([
					User.findOne({ _id: id }),
					Note.findOne({ _id: id })
				]);

				const packed = await mergePack(user, note);
				if (packed !== null) return packed;
			}

			const [user, note] = await Promise.all([
				User.findOne({ uri: object.id }),
				Note.findOne({ uri: object.id })
			]);

			const packed = await mergePack(user, note);
			if (packed !== null) return packed;
		}

		// それでもみつからなければ新規であるため登録
		if (validActor.includes(object.type)) {
			const user = await createPerson(object.id);
			return {
				type: 'User',
				object: await packUser(user, null, { detail: true })
			};
		}

		if (validDocument.includes(object.type)) {
			const note = await createNote(object.id, null, true);
			return {
				type: 'Note',
				object: await packNote(note, null, { detail: true })
			};
		}
	} else if (`.${url && url.host}`.endsWith('.twitter.com')) {
		const note = await createNoteFromTwitter(uri, resolver, true);

		if (note) {
			return {
				type: 'Note',
				object: await packNote(note, null, { detail: true })
			};
		}

		const user = await createUserFromTwitter(uri, resolver);

		if (user) {
			return {
				type: 'User',
				object: await packUser(user, null, { detail: true })
			};
		}
	}

	return null;
}

async function mergePack(user: IUser, note: INote) {
	if (user !== null) {
		return {
			type: 'User',
			object: await packUser(user, null, { detail: true })
		};
	}

	if (note !== null) {
		return {
			type: 'Note',
			object: await packNote(note, null, { detail: true })
		};
	}

	return null;
}
