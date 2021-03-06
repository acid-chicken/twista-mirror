<template>
<div class="mk-post-form">
	<div class="form">
		<header>
			<button class="cancel" @click="cancel"><fa :icon="['fal', 'times']"/></button>
			<div>
				<span class="text-count" :class="{ over: trimmedLength(text) > maxNoteTextLength }">{{ maxNoteTextLength - trimmedLength(text) }}</span>
				<span class="geo" v-if="geo"><fa :icon="['fal', 'map-marker-alt']"/></span>
				<button class="submit" :disabled="!canPost" @click="post">{{ submitText }}</button>
			</div>
		</header>
		<div class="form">
			<mk-note-preview class="preview" v-if="reply" :note="reply"/>
			<mk-note-preview class="preview" v-if="renote" :note="renote"/>
			<div v-if="visibility == 'specified'" class="visible-users">
				<span class="title">
					<fa :icon="['fal', 'user-friends']" class="ako"/>
					<span>{{ $t('@.send-to') }}</span>
				</span>
				<a class="visible-user" @click="removeVisibleUser(u)" v-for="u in visibleUsers">
					<div><fa :icon="['fal', 'user-minus']" fixed-width/></div>
					<span>
						<mk-avatar :user="u"/>
						<mk-user-name :user="u"/>
					</span>
				</a>
				<a @click="addVisibleUser">
					<fa :icon="['fal', 'user-plus']" class="ako"/>
				</a>
			</div>
			<input v-show="useCw" ref="cw" v-model="cw" :placeholder="$t('cw-placeholder')" v-autocomplete="{ model: 'cw' }">
			<textarea v-model="text" ref="text" :disabled="posting" :placeholder="placeholder" v-autocomplete="{ model: 'text' }"></textarea>
			<input v-show="useBroadcast" ref="broadcast" v-model="broadcast" :placeholder="$t('broadcast-placeholder')" v-autocomplete="{ model: 'broadcast' }">
			<ui-select v-model="postAs" v-if="usePostAs">
				<template #label>{{ $t('post-as') }}</template>
				<option value="information">{{ $t('information') }}</option>
			</ui-select>
			<x-post-form-attaches class="attaches" :files="files"/>
			<mk-poll-editor v-if="poll" ref="poll" @destroyed="poll = false" @updated="onPollUpdate()"/>
			<mk-uploader ref="uploader" @uploaded="attachMedia" @change="onChangeUploadings"/>
			<footer>
				<button class="upload" @click="chooseFile"><fa :icon="['fal', 'upload']"/></button>
				<button class="drive" @click="chooseFileFromDrive"><fa :icon="['fal', 'cloud']"/></button>
				<button class="kao" @click="kao"><fa :icon="['fal', 'cat']"/></button>
				<button class="poll" @click="poll = true"><fa :icon="['fal', 'poll-people']"/></button>
				<button class="cw" @click="useCw = !useCw"><fa :icon="['fal', 'eye-slash']"/></button>
				<button class="broadcast" @click="useBroadcast = !useBroadcast"><fa :icon="['fal', 'bullhorn']"/></button>
				<button class="post-as" @click="usePostAs = !usePostAs" v-if="$store.getters.isSignedIn && ($store.state.i.isAdmin || $store.state.i.isModerator)"><fa :icon="['fal', 'user-ninja']"/></button>
				<button class="geo" @click="geo ? removeGeo() : setGeo()" v-if="false"><fa :icon="['fal', 'map-marker-alt']"/></button>
				<button class="rating" :title="$t('rating')" @click="setRating" ref="ratingButton">
					<span v-if="rating === null"><fa :icon="['fal', 'eye']"/></span>
					<span v-if="rating === '0'"><fa :icon="['fal', 'baby']"/></span>
					<span v-if="rating === '12'"><fa :icon="['fal', 'child']"/></span>
					<span v-if="rating === '15'"><fa :icon="['fal', 'people-carry']"/></span>
					<span v-if="rating === '18'"><fa :icon="['fal', 'person-booth']"/></span>
				</button>
				<button class="visibility" @click="setVisibility" ref="visibilityButton">
					<x-visibility-icon :v="visibility" :localOnly="localOnly"/>
				</button>
			</footer>
			<input ref="file" class="file" type="file" multiple="multiple" @change="onChangeFile"/>
		</div>
	</div>
	<div class="hashtags" v-if="recentHashtags.length > 0 && $store.state.settings.suggestRecentHashtags">
		<a v-for="tag in recentHashtags.slice(0, 5)" @click="addTag(tag)">#{{ tag }}</a>
	</div>
</div>
</template>

<script lang="ts">
import Vue from 'vue';
import i18n from '../../../i18n';
import insertTextAtCursor from 'insert-text-at-cursor';
import MkVisibilityChooser from '../../../common/views/components/visibility-chooser.vue';
import MkRatingChooser from '../../../common/views/components/rating-chooser.vue';
import getFace from '../../../common/scripts/get-face';
import { parse } from '../../../../../mfm/parse';
import { host } from '../../../config';
import { erase, unique } from '../../../../../prelude/array';
import { length } from 'stringz';
import { toASCII } from 'punycode';
import extractMentions from '../../../../../misc/extract-mentions';
import XPostFormAttaches from '../../../common/views/components/post-form-attaches.vue';
import XVisibilityIcon from '../../../common/views/components/visibility-icon.vue';

export default Vue.extend({
	i18n: i18n('mobile/views/components/post-form.vue'),
	components: {
		XPostFormAttaches,
		XVisibilityIcon,
	},

	props: {
		reply: {
			type: Object,
			required: false
		},
		renote: {
			type: Object,
			required: false
		},
		mention: {
			type: Object,
			required: false
		},
		quote: {
			type: Boolean,
			required: false,
			default: false
		},
		initialText: {
			type: String,
			required: false
		},
		initialNote: {
			type: Object,
			required: false
		},
		instant: {
			type: Boolean,
			required: false,
			default: false
		}
	},

	data() {
		return {
			posting: false,
			text: '',
			uploadings: [],
			files: [],
			poll: false,
			pollChoices: [],
			pollMultiple: false,
			useBroadcast: false,
			broadcast: '',
			geo: null,
			visibility: 'public',
			visibleUsers: [],
			localOnly: false,
			rating: null,
			secondaryNoteVisibility: 'none',
			tertiaryNoteVisibility: 'none',
			useCw: false,
			cw: null,
			usePostAs: false,
			postAs: null,
			recentHashtags: JSON.parse(localStorage.getItem('hashtags') || '[]'),
			maxNoteTextLength: 1000
		};
	},

	created() {
		this.$root.getMeta().then(meta => {
			this.maxNoteTextLength = meta.maxNoteTextLength;
		});
	},

	computed: {
		draftId(): string {
			return this.renote
				? `renote:${this.renote.id}`
				: this.reply
					? `reply:${this.reply.id}`
					: 'note';
		},

		placeholder(): string {
			const xs = [
				this.$t('@.note-placeholders.a'),
				this.$t('@.note-placeholders.b'),
				this.$t('@.note-placeholders.c'),
				this.$t('@.note-placeholders.d'),
				this.$t('@.note-placeholders.e'),
				this.$t('@.note-placeholders.f')
			];
			const x = xs[Math.floor(Math.random() * xs.length)];

			return this.renote
				? this.$t('quote-placeholder')
				: this.reply
					? this.$t('reply-placeholder')
					: x;
		},

		submitText(): string {
			return (this.renote && !this.quote)
				? this.$t('renote')
				: this.reply
					? this.$t('reply')
					: this.$t('submit');
		},

		concatenated(): string {
			return [this.text, ...(this.useBroadcast && this.broadcast && this.broadcast.length ? [this.broadcast] : [])].join(' ');
		},

		canPost(): boolean {
			return !this.posting &&
				(this.text.length || this.files.length || this.poll || this.renote) &&
				length(this.concatenated.trim()) < this.maxNoteTextLength &&
				(!this.poll || this.pollChoices.length >= 2);
		}
	},

	mounted() {
		if (this.initialText) {
			this.text = this.initialText;
		}

		if (this.reply && this.reply.user.host != null) {
			this.text = `@${this.reply.user.username}@${toASCII(this.reply.user.host)} `;
		}

		if (this.mention) {
			this.text = this.mention.host ? `@${this.mention.username}@${toASCII(this.mention.host)}` : `@${this.mention.username}`;
			this.text += ' ';
		}

		if (this.reply && this.reply.text != null) {
			const ast = parse(this.reply.text);

			for (const x of extractMentions(ast)) {
				const mention = x.host ? `@${x.username}@${toASCII(x.host)}` : `@${x.username}`;

				// 自分は除外
				if (this.$store.state.i.username == x.username && x.host == null) continue;
				if (this.$store.state.i.username == x.username && x.host == host) continue;

				// 重複は除外
				if (this.text.indexOf(`${mention} `) != -1) continue;

				this.text += `${mention} `;
			}
		}

		// デフォルト公開範囲
		this.applyVisibility(this.$store.state.settings.rememberNoteVisibility ? (this.$store.state.device.visibility || this.$store.state.settings.defaultNoteVisibility) : this.$store.state.settings.defaultNoteVisibility);

		this.secondaryNoteVisibility = this.$store.state.settings.secondaryNoteVisibility;
		this.tertiaryNoteVisibility = this.$store.state.settings.tertiaryNoteVisibility;

		// 公開以外へのリプライ時は元の公開範囲を引き継ぐ
		if (this.reply && ['home', 'followers', 'specified'].includes(this.reply.visibility)) {
			this.visibility = this.reply.visibility;
			if (this.reply.visibility === 'specified') {
				this.$root.api('users/show', {
					userIds: this.reply.visibleUserIds.filter(uid => uid !== this.$store.state.i.id && uid !== this.reply.userId)
				}).then(users => {
					this.visibleUsers.push(...users);
				});
			}
		}

		if (this.reply && this.reply.userId !== this.$store.state.i.id) {
			this.rating = this.reply.rating;
			this.$root.api('users/show', { userId: this.reply.userId }).then(user => {
				this.visibleUsers.push(user);
			});
		}

		// keep cw when reply
		if (this.$store.state.settings.keepCw && this.reply && this.reply.cw) {
			this.useCw = true;
			this.cw = this.reply.cw;
		}

		this.focus();

		this.$nextTick(() => {
			if (this.initialNote) {
				// 削除して編集
				const init = this.initialNote;
				this.text =
					this.normalizedText(this.initialText) ||
					this.normalizedText(this.text) ||
					this.normalizedText(init.text) || '';
				this.files = init.files;
				this.cw = init.cw;
				this.useCw = init.cw != null;
				if (init.poll) {
					this.poll = true;
					this.$nextTick(() => {
						(this.$refs.poll as any).set({
							choices: init.poll.choices.map(c => c.text),
							multiple: init.poll.multiple
						});
					});
				}
				this.visibility = init.visibility;
				this.localOnly = init.localOnly;
				this.quoteId = init.renote ? init.renote.id : null;
			}
			
			this.$nextTick(this.focus);
		});
	},

	methods: {
		normalizedText(maybeText?: string | null) {
			return typeof maybeText === 'string' && this.trimmedLength(maybeText) ? maybeText : null;
		},

		trimmedLength(text: string) {
			return length(text.trim());
		},

		addTag(tag: string) {
			insertTextAtCursor(this.$refs.text, ` #${tag} `);
		},

		focus() {
			(this.$refs.text as any).focus();
		},

		addVisibleUser() {
			this.$root.dialog({
				title: this.$t('@.enter-username'),
				user: true
			}).then(({ canceled, result: user }) => {
				if (canceled) return;
				this.visibleUsers.push(user);
			});
		},

		chooseFile() {
			(this.$refs.file as any).click();
		},

		chooseFileFromDrive() {
			this.$chooseDriveFile({
				multiple: true
			}).then(files => {
				for (const x of files) this.attachMedia(x);
			});
		},

		attachMedia(driveFile) {
			if (driveFile.error) {
				this.$notify(driveFile.error.message);
				return;
			}
			this.files.push(driveFile);
			this.$emit('change-attached-files', this.files);
		},

		detachMedia(id) {
			this.files = this.files.filter(x => x.id != id);
			this.$emit('change-attached-files', this.files);
		},

		onChangeFile() {
			for (const x of Array.from((this.$refs.file as any).files)) this.upload(x);
		},

		onPollUpdate() {
			const got = this.$refs.poll.get();
			this.pollChoices = got.choices;
			this.pollMultiple = got.multiple;
		},

		upload(file) {
			(this.$refs.uploader as any).upload(file);
		},

		onChangeUploadings(uploads) {
			this.$emit('change-uploadings', uploads);
		},

		setVisibility() {
			const w = this.$root.new(MkVisibilityChooser, {
				source: this.$refs.visibilityButton,
				currentVisibility: this.visibility,
				currentLocalOnly: this.localOnly
			});
			w.$once('chosen', v => {
				this.applyVisibility(v);
			});
		},

		setRating() {
			const w = this.$root.new(MkRatingChooser, {
				source: this.$refs.ratingButton,
				currentRating: this.rating
			});
			w.$once('chosen', v => {
				this.applyRating(v);
			});
		},

		applyVisibility(v :string) {
			const m = v.match(/^local-(.+)/);
			if (m) {
				this.localOnly = true;
				this.visibility = m[1];
			} else {
				this.localOnly = false;
				this.visibility = v;
			}
		},

		applyRating(v :string) {
			this.rating = v;
		},

		removeVisibleUser(user) {
			this.visibleUsers = erase(user, this.visibleUsers);
		},

		clear() {
			this.text = '';
			this.files = [];
			this.poll = false;
			this.$emit('change-attached-files');
		},

		post(v: any) {
			let visibility = this.visibility;
			let localOnly = this.localOnly;

			// ただのRenoteはクライアントでvisibilityを指定しない
			if (this.renote && !this.quote) visibility = undefined;

			if (typeof v == 'string') {
				const m = v.match(/^local-(.+)/);
				if (m) {
					localOnly = true;
					visibility = m[1];
				} else {
					localOnly = false;
					visibility = v;
				}
			}

			this.posting = true;
			const viaMobile = this.$store.state.settings.disableViaMobile !== true;
			this.$root.api('notes/create', {
				text: this.concatenated.length ? this.concatenated : undefined,
				fileIds: this.files.length ? this.files.map(f => f.id) : undefined,
				replyId: this.reply ? this.reply.id : undefined,
				renoteId: this.renote ? this.renote.id : undefined,
				poll: this.poll ? (this.$refs.poll as any).get() : undefined,
				cw: this.useCw ? this.cw || '' : undefined,
				as: this.usePostAs && this.postAs ? this.postAs : undefined,
				geo: /*this.geo ? {
					coordinates: [this.geo.longitude, this.geo.latitude],
					altitude: this.geo.altitude,
					accuracy: this.geo.accuracy,
					altitudeAccuracy: this.geo.altitudeAccuracy,
					heading: isNaN(this.geo.heading) ? null : this.geo.heading,
					speed: this.geo.speed,
				} : */null,
				visibility,
				visibleUserIds: this.visibility == 'specified' ? this.visibleUsers.map(u => u.id) : undefined,
				localOnly,
				rating: this.rating,
				viaMobile: viaMobile
			}).then(data => {
				this.$emit('posted');
			}).catch(err => {
				this.posting = false;
			});

			if (this.text && this.text != '') {
				const hashtags = parse(this.text).filter(x => x.node.type === 'hashtag').map(x => x.node.props.hashtag);
				const history = JSON.parse(localStorage.getItem('hashtags') || '[]') as string[];
				localStorage.setItem('hashtags', JSON.stringify(unique(hashtags.concat(history))));
			}
		},

		cancel() {
			this.$emit('cancel');
		},

		kao() {
			this.text += getFace();
		}
	}
});
</script>

<style lang="stylus" scoped>
.mk-post-form
	max-width 500px
	width calc(100% - 16px)
	margin 8px auto

	@media (min-width 500px)
		margin 16px auto
		width calc(100% - 32px)

		> .form
			box-shadow 0 8px 32px rgba(#000, 0.1)

	@media (min-width 600px)
		margin 32px auto

	> .form
		background var(--bg)
		border-radius 8px
		box-shadow 0 0 2px rgba(#000, 0.1)

		> header
			z-index 1000
			height 50px
			box-shadow 0 1px 0 0 var(--mobilePostFormDivider)

			> .cancel
				padding 0
				width 50px
				line-height 50px
				font-size 24px
				color var(--text)

			> div
				position absolute
				top 0
				right 0
				color var(--text)

				> .text-count
					line-height 50px
					margin-right 6px

				> .geo
					margin 0 8px
					line-height 50px

				> .secondary, .tertiary
					margin 8px 6px
					padding 0 16px
					line-height 34px
					vertical-align bottom
					color var(--text)
					background var(--buttonBg)
					border-radius 4px

					&:disabled
						opacity 0.7

				> .submit
					margin 8px 6px
					padding 0 16px
					line-height 34px
					min-width 80px
					vertical-align bottom
					color var(--primaryForeground)
					background var(--primary)
					border-radius 4px

					&:disabled
						opacity 0.7

		> .form
			max-width 500px
			margin 0 auto

			> .preview
				padding 16px

			> .visible-users
				align-items center
				display flex
				flex-flow wrap
				gap 8px
				margin 8px

				.ako
					height 32px
					margin 0 6px
					padding 6px 0
					vertical-align bottom

				> .title
					color var(--text)
					padding 0 6px 0 0

					> span
						vertical-align 4px

				> .visible-user
					align-items center
					border solid 1px
					border-radius 16px
					display flex
					height 32px
					overflow hidden

					&:hover
						> *:first-child
							padding 0 0 0 2px
							width 32px

						> *:last-child
							padding 0 2px 0 0

					> *
						align-items center
						display flex
						justify-content center
						transition all .2s ease

						&:first-child
							align-items center
							background currentColor
							display flex
							height 100%
							justify-content center
							width 0

							> svg
								color var(--secondary)
						
						&:last-child
							flex 1 0 auto
							gap 4px
							margin 0 8px
							padding 0 18px 0 16px

							> .mk-avatar
								height 24px
								width 24px

			> input
				z-index 1

			> input
			> textarea
				display block
				padding 12px
				margin 0
				width 100%
				font-size 16px
				color var(--inputText)
				background var(--mobilePostFormTextareaBg)
				border none
				border-radius 0
				box-shadow 0 1px 0 0 var(--mobilePostFormDivider)

				&:disabled
					opacity 0.5

			> textarea
				max-width 100%
				min-width 100%
				min-height 80px

			> .ui-select
				margin 24px 8px 0

			> .mk-uploader
				margin 8px 0 0 0
				padding 8px

			> .file
				display none

			> footer
				white-space nowrap
				overflow auto
				-webkit-overflow-scrolling touch
				overflow-scrolling touch

				> *
					display inline-block
					padding 0
					margin 0
					width 48px
					height 48px
					font-size 20px
					color var(--mobilePostFormButton)
					background transparent
					outline none
					border none
					border-radius 0
					box-shadow none
					opacity 0.7

				> .visibility > .localOnly
					color var(--primary)
					position absolute
					top 0
					right 0.2em
					transform scale(.8)

				> .quote
					display block
					margin-right auto
					margin-left 8px
					color var(--link)

	> .hashtags
		margin 8px

		> *
			margin-right 8px
</style>
