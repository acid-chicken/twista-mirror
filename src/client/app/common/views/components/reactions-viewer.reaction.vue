<template>
<span
	class="reaction"
	:class="{ reacted: note.myReaction == reaction }"
	:title="reaction.match(/^\w/) ? `:${reaction}:` : reaction"
	@click="toggleReaction(reaction)"
	v-if="count > 0"
	v-particle:congrats="!isMe && reaction === 'congrats'"
	v-particle="!isMe && reaction !== 'congrats'"
>
	<mk-reaction-icon :reaction="reaction" ref="icon"/>
	<span>{{ count }}</span>
</span>
</template>

<script lang="ts">
import Vue from 'vue';
import Icon from './reaction-icon.vue';
import anime from 'animejs';

export default Vue.extend({
	props: {
		reaction: {
			type: String,
			required: true,
		},
		count: {
			type: Number,
			required: true,
		},
		note: {
			type: Object,
			required: true,
		},
		canToggle: {
			type: Boolean,
			required: false,
			default: true,
		},
	},
	computed: {
		isMe(): boolean {
			return this.$store.getters.isSignedIn && this.$store.state.i.id === this.note.userId;
		},
	},
	watch: {
		count() {
			this.anime();
		},
	},
	methods: {
		toggleReaction() {
			if (this.isMe) return;
			if (!this.canToggle) return;

			const oldReaction = this.note.myReaction;
			if (oldReaction) {
				this.$root.api('notes/reactions/delete', {
					noteId: this.note.id
				}).then(() => {
					if (oldReaction !== this.reaction) {
						this.$root.api('notes/reactions/create', {
							noteId: this.note.id,
							reaction: this.reaction
						});
					}
				});
			} else {
				this.$root.api('notes/reactions/create', {
					noteId: this.note.id,
					reaction: this.reaction
				});
			}
		},
		anime() {
			if (this.$store.state.device.reduceMotion) return;
			if (document.hidden) return;

			this.$nextTick(() => {
				const rect = this.$refs.icon.$el.getBoundingClientRect();

				const x = rect.left;
				const y = rect.top;

				const icon = new Icon({
					parent: this,
					propsData: {
						reaction: this.reaction
					}
				}).$mount();

				icon.$el.style.position = 'absolute';
				icon.$el.style.zIndex = 100;
				icon.$el.style.top = (y + window.scrollY) + 'px';
				icon.$el.style.left = (x + window.scrollX) + 'px';
				icon.$el.style.fontSize = window.getComputedStyle(this.$refs.icon.$el).fontSize;

				document.body.appendChild(icon.$el);

				anime({
					targets: icon.$el,
					opacity: [1, 0],
					translateY: [0, -64],
					duration: 1000,
					easing: 'linear',
					complete: () => {
						icon.destroyDom();
					}
				});
			});
		},
	}
});
</script>

<style lang="stylus" scoped>
.reaction
	display inline-block
	height 32px
	margin 2px
	padding 0 6px
	border-radius 4px

	*
		user-select none
		-moz-user-select none
		pointer-events none

	&.reacted
		background var(--primary)

		> span
			color var(--primaryForeground)

	&:not(.reacted)
		background var(--reactionViewerButtonBg)

		&:hover
			background var(--reactionViewerButtonHoverBg)

	> span
		font-size 1.1em
		line-height 32px
		color var(--text)
</style>
