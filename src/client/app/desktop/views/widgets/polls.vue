<template>
<div class="mkw-polls">
	<ui-container :show-header="!props.compact">
		<template #header><fa :icon="['fal', 'poll-people']"/>{{ $t('title') }}</template>
		<template #func>
			<button :title="$t('title')" @click="fetch">
				<fa v-if="!fetching && more" :icon="['fal', 'arrow-right']"/>
				<fa v-if="!fetching && !more" :icon="['fal', 'sync']"/>
			</button>
		</template>

		<div class="mkw-polls--body">
			<p class="fetching" v-if="fetching"><fa :icon="['fal', 'spinner']" pulse fixed-width/>{{ $t('@.loading') }}<mk-ellipsis/></p>
			<div class="poll" v-else-if="poll">
				<p>
					<router-link :to="poll | notePage">
						<mochimochi-fuwafuwa-markup :text="poll.text" :author="poll.user" :custom-emojis="poll.emojis" v-if="poll.text"/>
						<fa :icon="['fal', 'link']" v-else/>
					</router-link>
				</p>
				<mk-poll :note="poll"/>
			</div>
			<p class="empty" v-else>{{ $t('nothing') }}</p>
		</div>
	</ui-container>
</div>
</template>

<script lang="ts">
import define from '../../../common/define-widget';
import i18n from '../../../i18n';

export default define({
	name: 'polls',
	props: () => ({
		compact: false
	})
}).extend({
	i18n: i18n('desktop/views/widgets/polls.vue'),
	data() {
		return {
			poll: null,
			fetching: true,
			more: true,
			offset: 0
		};
	},
	mounted() {
		this.fetch();
	},
	methods: {
		func() {
			this.props.compact = !this.props.compact;
			this.save();
		},
		fetch() {
			this.fetching = true;
			this.poll = null;

			this.$root.api('notes/polls/recommendation', {
				limit: 1,
				offset: this.offset
			}).then(notes => {
				const poll = notes ? notes[0] : null;
				if (poll == null) {
					this.more = false;
					this.offset = 0;
				} else {
					this.more = true;
					this.offset++;
				}
				this.poll = poll;
				this.fetching = false;
			}).catch(() => {
				this.poll = null;
				this.fetching = false;
				this.more = false;
			});
		}
	}
});
</script>

<style lang="stylus" scoped>
.mkw-polls--body
	> .poll
		padding 16px
		font-size 12px
		color var(--text)

		> p
			margin 0 0 8px 0

			> a
				color inherit

	> .empty
		margin 0
		padding 16px
		text-align center
		color var(--text)

	> .fetching
		margin 0
		padding 16px
		text-align center
		color var(--text)

		> [data-icon]
			margin-right 4px
</style>
