import $ from 'cafy';
import ID, { transform, transformMany } from '../../../../misc/cafy-id';
import User, { pack, isRemoteUser } from '../../../../models/user';
import resolveRemoteUser from '../../../../remote/resolve-user';
import define from '../../define';
import { apiLogger } from '../../logger';
import { ApiError } from '../../error';
import { createUserFromTwitter } from '../../../../remote/external/twitter';
import Resolver from '../../../../remote/activitypub/resolver';

const cursorOption = { fields: { data: false } };

export const meta = {
	desc: {
		'ja-JP': '指定したユーザーの情報を取得します。'
	},

	tags: ['users'],

	requireCredential: false,

	params: {
		userId: {
			validator: $.optional.type(ID),
			transform: transform,
			desc: {
				'ja-JP': '対象のユーザーのID',
				'en-US': 'Target user ID'
			}
		},

		userIds: {
			validator: $.optional.arr($.type(ID)).unique(),
			transform: transformMany,
			desc: {
				'ja-JP': 'ユーザーID (配列)'
			}
		},

		username: {
			validator: $.optional.str
		},

		host: {
			validator: $.optional.nullable.str
		}
	},

	res: {
		type: 'User',
	},

	errors: {
		failedToResolveRemoteUser: {
			message: 'Failed to resolve remote user.',
			code: 'FAILED_TO_RESOLVE_REMOTE_USER',
			id: 'ef7b9be4-9cba-4e6f-ab41-90ed171c7d3c',
			kind: 'server' as 'server'
		},

		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '4362f8dc-731f-4ad8-a694-be5a88922a24'
		},
	}
};

export default define(meta, async (ps, me) => {
	let user;

	if (ps.userIds) {
		const users = await User.find({
			_id: {
				$in: ps.userIds
			}
		});

		return await Promise.all(users.map(u => pack(u, me, {
			detail: true
		})));
	} else {
		// Lookup user
		if (ps.host === 'twitter.com') {
			user = await createUserFromTwitter({ user: { screen_name: ps.username } }, new Resolver()).catch(e => {
				apiLogger.warn(`failed to resolve remote user; via Twitter: ${e}`);
				throw new ApiError(meta.errors.failedToResolveRemoteUser);
			});

			if (!user) {
				apiLogger.warn('failed to resolve remote user; via Twitter');
				throw new ApiError(meta.errors.failedToResolveRemoteUser);
			}
		} else if (typeof ps.host === 'string') {
			user = await resolveRemoteUser(ps.username, ps.host, cursorOption).catch(e => {
				apiLogger.warn(`failed to resolve remote user: ${e}`);
				throw new ApiError(meta.errors.failedToResolveRemoteUser);
			});
		} else {
			const q: any = ps.userId != null
				? { _id: ps.userId }
				: { usernameLower: ps.username.toLowerCase(), host: null };

			user = await User.findOne(q, cursorOption);

			if (isRemoteUser(user)) {
				resolveRemoteUser(user.username, user.host);
			}
		}

		if (user === null) {
			throw new ApiError(meta.errors.noSuchUser);
		}

		return await pack(user, me, {
			detail: true
		});
	}
});
