<template>
<div class="cpu">
	<x-pie class="pie" :value="usage"/>
	<div>
		<p><fa :icon="['fal', 'microchip']"/>CPU</p>
		<p>{{ meta.cpu.cores }} Logical cores</p>
		<p>{{ meta.cpu.model }}</p>
	</div>
</div>
</template>

<script lang="ts">
import Vue from 'vue';
import XPie from './server.pie.vue';

export default Vue.extend({
	components: {
		XPie
	},
	props: ['connection', 'meta'],
	data() {
		return {
			usage: 0
		};
	},
	mounted() {
		this.connection.on('stats', this.onStats);
	},
	beforeDestroy() {
		this.connection.off('stats', this.onStats);
	},
	methods: {
		onStats(stats) {
			this.usage = stats.cpu_usage;
		}
	}
});
</script>

<style lang="stylus" scoped>
.cpu
	> .pie
		padding 10px
		height 100px
		float left

	> div
		float left
		width calc(100% - 100px)
		padding 10px 10px 10px 0

		> p
			margin 0
			font-size 12px
			color var(--chartCaption)

			&:first-child
				font-family fot-rodin-pron, a-otf-ud-shin-go-pr6n, sans-serif
				font-weight 600

				> [data-icon]
					margin-right 4px

	&:after
		content ""
		display block
		clear both
</style>
