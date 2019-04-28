import * as Twitter from 'twit';
import * as request from 'request-promise-native';
import { IObject } from './type';
import config from '../../config';
import fetchMeta from '../../misc/fetch-meta';

export interface IResolverOptions {
	twitter?: {
		accessToken: string;
		accessTokenSecret: string;
	};
}

export default class Resolver {
	private history: Set<string>;
	private timeout = 10 * 1000;
	public twitter?: Twitter;
	public twitterPromise: Promise<Twitter>;

	constructor(options?: IResolverOptions) {
		this.history = new Set();

		this.twitterPromise = fetchMeta().then(meta => this.twitter = new Twitter({
			consumer_key: meta.twitterConsumerKey,
			consumer_secret: meta.twitterConsumerSecret,
			strictSSL: true,
			...(options && typeof options === 'object' && options.twitter ? {
				access_token: options.twitter.accessToken,
				access_token_secret: options.twitter.accessTokenSecret
			} : {
				app_only_auth: true
			})
		}));
	}

	public getHistory(): string[] {
		return Array.from(this.history);
	}

	public async resolveCollection(value: any) {
		const collection = typeof value === 'string'
			? await this.resolve(value)
			: value;

		switch (collection.type) {
			case 'Collection':
			case 'CollectionPage':
				collection.objects = collection.items;
				break;

			case 'OrderedCollection':
			case 'OrderedCollectionPage':
				collection.objects = collection.orderedItems;
				break;

			default:
				throw new Error(`unknown collection type: ${collection.type}`);
		}

		return collection;
	}

	public async resolve(value: any): Promise<IObject> {
		if (value == null) {
			throw new Error('resolvee is null (or undefined)');
		}

		if (typeof value !== 'string') {
			return value;
		}

		if (this.history.has(value)) {
			throw new Error('cannot resolve already resolved one');
		}

		this.history.add(value);

		console.log(`ResolveRequest: ${value}`);
		const object = await request({
			url: value,
			proxy: config.proxy,
			timeout: this.timeout,
			forever: true,
			headers: {
				'User-Agent': config.userAgent,
				Accept: 'application/activity+json, application/ld+json'
			},
			json: true
		});

		if (object === null || (
			Array.isArray(object['@context']) ?
				!object['@context'].includes('https://www.w3.org/ns/activitystreams') :
				object['@context'] !== 'https://www.w3.org/ns/activitystreams'
		)) {
			throw new Error('invalid response');
		}

		return object;
	}
}
