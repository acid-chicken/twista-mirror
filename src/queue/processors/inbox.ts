import * as Bull from 'bull';
import * as httpSignature from 'http-signature';
import parseAcct from '../../misc/acct/parse';
import User, { IRemoteUser } from '../../models/user';
import perform from '../../remote/activitypub/perform';
import { resolvePerson } from '../../remote/activitypub/models/person';
import { toUnicode } from 'punycode';
import { URL } from 'url';
import { publishApLogStream } from '../../services/stream';
import Logger from '../../services/logger';
import { registerOrFetchInstanceDoc } from '../../services/register-or-fetch-instance-doc';
import Instance from '../../models/instance';
import instanceChart from '../../services/chart/instance';
import { IActivity, getApId } from '../../remote/activitypub/type';
import { toDbHost } from '../../misc/convert-host';
import { detectSystem } from '../../remote/activitypub/misc/detect-system';

const logger = new Logger('inbox');

// ユーザーのinboxにアクティビティが届いた時の処理
export default async (job: Bull.Job): Promise<void> => {
	const signature = job.data.signature as httpSignature.IParsedSignature;
	const activity = job.data.activity as IActivity;

	//#region Log
	const info = Object.assign({}, activity);
	delete info['@context'];
	delete info['signature'];
	logger.debug(JSON.stringify(info, null, 2));
	//#endregion

	const keyIdLower = signature.keyId.toLowerCase();
	let user: IRemoteUser;

	if (keyIdLower.startsWith('acct:')) {
		const { username, host } = parseAcct(keyIdLower.slice('acct:'.length));
		if (host === null) {
			logger.warn(`request was made by local user: @${username}`);
			return;
		}

		// アクティビティ内のホストの検証
		try {
			validateActivity(activity, host);
		} catch (e) {
			logger.warn(e.message);
			return;
		}

		// ブロックしてたら中断
		// TODO: いちいちデータベースにアクセスするのはコスト高そうなのでどっかにキャッシュしておく
		const instance = await Instance.findOne({ host: toDbHost(host) });
		if (instance && instance.isBlocked) {
			logger.info(`Blocked request: ${host}`);
			return;
		}

		user = await User.findOne({ usernameLower: username, host: host.toLowerCase() }) as IRemoteUser;
	} else {
		// アクティビティ内のホストの検証
		const host = toUnicode(new URL(signature.keyId).hostname.toLowerCase());
		try {
			validateActivity(activity, host);
		} catch (e) {
			logger.warn(e.message);
			return;
		}

		// ブロックしてたら中断
		// TODO: いちいちデータベースにアクセスするのはコスト高そうなのでどっかにキャッシュしておく
		const instance = await Instance.findOne({ host: toDbHost(host) });
		if (instance && instance.isBlocked) {
			logger.warn(`Blocked request: ${host}`);
			return;
		}

		user = await User.findOne({
			host: { $ne: null },
			'publicKey.id': signature.keyId
		}) as IRemoteUser;
	}

	/*
	// Update activityの場合は、ここで署名検証/更新処理まで実施して終了
	if (activity.type === 'Update') {
		if (activity.object && validActor.includes(activity.object.type)) {
			if (user == null) {
				logger.warn('Update activity received, but user not registed.');
			} else if (!httpSignature.verifySignature(signature, user.publicKey.publicKeyPem)) {
				logger.warn('Update activity received, but signature verification failed.');
			} else {
				updatePerson(activity.actor, null, activity.object);
			}
			return;
		}
	}
	*/

	// アクティビティを送信してきたユーザーがまだtwistaサーバーに登録されていなかったら登録する
	if (user === null) {
		try {
			user = await resolvePerson(getApId(activity.actor)) as IRemoteUser;
		} catch (e) {
			// 対象が4xxならスキップ
			if (e.statusCode >= 400 && e.statusCode < 500) {
				logger.warn(`Ignored actor ${activity.actor} - ${e.statusCode}`);
				return;
			}
			logger.error(`Error in actor ${activity.actor} - ${e.statusCode || e}`);
			throw e;
		}
	}

	if (user === null) {
		throw new Error('failed to resolve user');
	}

	if (!httpSignature.verifySignature(signature, user.publicKey.publicKeyPem)) {
		logger.error('signature verification failed');
		return;
	}

	//#region Log
	publishApLogStream({
		direction: 'in',
		activity: activity.type,
		host: user.host,
		actor: user.username
	});
	//#endregion

	// Update stats
	registerOrFetchInstanceDoc(user.host).then(i => {
		const set = {
			latestRequestReceivedAt: new Date(),
			lastCommunicatedAt: new Date(),
			isNotResponding: false
		} as any;

		const system = detectSystem(activity);
		if (system != null) set.system = system;

		Instance.update({ _id: i._id }, {
			$set: set
		});

		instanceChart.requestReceived(i.host);
	});

	// アクティビティを処理
	await perform(user, activity);
};

/**
 * Validate host in activity
 * @param activity Activity
 * @param host Expect host
 */
function validateActivity(activity: any, host: string) {
	// id (if exists)
	if (typeof activity.id === 'string') {
		const uriHost = toUnicode(new URL(activity.id).hostname.toLowerCase());
		if (host !== uriHost) {
			const diag = activity.signature ? '. Has LD-Signature. Forwarded?' : '';
			throw new Error(`activity.id(${activity.id}) has different host(${host})${diag}`);
		}
	}

	// actor (if exists)
	if (typeof activity.actor === 'string') {
		const uriHost = toUnicode(new URL(activity.actor).hostname.toLowerCase());
		if (host !== uriHost) throw new Error('activity.actor has different host');
	}

	// For Create activity
	if (activity.type === 'Create' && activity.object) {
		// object.id (if exists)
		if (typeof activity.object.id === 'string') {
			const uriHost = toUnicode(new URL(activity.object.id).hostname.toLowerCase());
			if (host !== uriHost) throw new Error('activity.object.id has different host');
		}

		// object.attributedTo (if exists)
		if (typeof activity.object.attributedTo === 'string') {
			const uriHost = toUnicode(new URL(activity.object.attributedTo).hostname.toLowerCase());
			if (host !== uriHost) throw new Error('activity.object.attributedTo has different host');
		} else if (Array.isArray(activity.object.attributedTo)) {
			const hosts = (activity.object.attributedTo as any[])
				.filter(x => typeof x === 'string')
				.map(x => toUnicode(new URL(x).hostname.toLowerCase()));
			if (hosts.length && !hosts.includes(host)) throw new Error('activity.object.attributedTo doesn\'t have same host');
		}
	}
}
