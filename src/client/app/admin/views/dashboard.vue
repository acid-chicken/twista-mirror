<template>
<div class="obdskegsannmntldydackcpzezagxqfy">
	<header v-if="meta">
		<p><b>twista</b><span>{{ meta.version }}</span></p>
		<p><b>Machine</b><span>{{ meta.machine }}</span></p>
		<p><b>OS</b><span>{{ meta.os }}</span></p>
		<p><b>Node</b><span>{{ meta.node }}</span></p>
	</header>

	<div v-if="stats" class="stats">
		<div>
			<div>
				<div><fa :icon="['fal', 'user']"/></div>
				<div>
					<span>{{ $t('accounts') }}</span>
					<b>{{ stats.originalUsersCount | number }}</b>
				</div>
			</div>
			<div>
				<span><fa :icon="['fal', 'home']"/> {{ $t('this-instance') }}</span>
				<span @click="setChartSrc('users')"><fa :icon="['fal', 'chart-bar']"/></span>
			</div>
		</div>
		<div>
			<div>
				<div><fa :icon="['fal', 'pencil']"/></div>
				<div>
					<span>{{ $t('notes') }}</span>
					<b>{{ stats.originalNotesCount | number }}</b>
				</div>
			</div>
			<div>
				<span><fa :icon="['fal', 'home']"/> {{ $t('this-instance') }}</span>
				<span @click="setChartSrc('notes')"><fa :icon="['fal', 'chart-bar']"/></span>
			</div>
		</div>
		<div>
			<div>
				<div><fa :icon="faDatabase"/></div>
				<div>
					<span>{{ $t('drive') }}</span>
					<b>{{ stats.driveUsageLocal | bytes }}</b>
				</div>
			</div>
			<div>
				<span><fa :icon="['fal', 'home']"/> {{ $t('this-instance') }}</span>
				<span @click="setChartSrc('drive')"><fa :icon="['fal', 'chart-bar']"/></span>
			</div>
		</div>
		<div>
			<div>
				<div><fa :icon="['fal', 'hdd']"/></div>
				<div>
					<span>{{ $t('instances') }}</span>
					<b>{{ stats.instances | number }}</b>
				</div>
			</div>
			<div>
				<span><fa :icon="['fal', 'globe']"/> {{ $t('federated') }}</span>
				<span @click="setChartSrc('federation-instances-total')"><fa :icon="['fal', 'chart-bar']"/></span>
			</div>
		</div>
	</div>

	<div class="charts">
		<x-charts ref="charts"/>
	</div>

	<div class="queue">
		<x-queue/>
	</div>

	<div class="cpu-memory">
		<x-cpu-memory :connection="connection"/>
	</div>
</div>
</template>

<script lang="ts">
import Vue from 'vue';
import i18n from '../../i18n';
import XCpuMemory from "./dashboard.cpu-memory.vue";
import XQueue from "./dashboard.queue-charts.vue";
import XCharts from "./dashboard.charts.vue";
import { faDatabase } from '@fortawesome/pro-light-svg-icons';

export default Vue.extend({
	i18n: i18n('admin/views/dashboard.vue'),

	components: {
		XCpuMemory,
		XQueue,
		XCharts,
	},

	data() {
		return {
			stats: null,
			connection: null,
			meta: null,
			clock: null,
			faDatabase
		};
	},

	created() {
		this.connection = this.$root.stream.useSharedConnection('serverStats');

		this.updateStats();
		this.clock = setInterval(this.updateStats, 60 * 1000);

		this.$root.getMeta().then(meta => {
			this.meta = meta;
		});
	},

	beforeDestroy() {
		this.connection.dispose();
		clearInterval(this.clock);
	},

	methods: {
		setChartSrc(src) {
			this.$refs.charts.setSrc(src);
		},

		updateStats() {
			this.$root.api('stats', {}, true).then(stats => {
				this.stats = stats;
			});
		}
	}
});
</script>

<style lang="stylus" scoped>
.obdskegsannmntldydackcpzezagxqfy
	padding 16px

	@media (min-width 500px)
		padding 16px

	> header
		display flex
		padding-bottom 16px
		border-bottom solid 1px var(--adminDashboardHeaderBorder)
		color var(--adminDashboardHeaderFg)
		font-size 14px
		white-space nowrap

		@media (max-width 1000px)
			display none

		> p
			display block
			margin 0 32px 0 0
			overflow hidden
			text-overflow ellipsis
			text-overflow -webkit-fade
			text-overflow -moz-fade
			text-overflow fade

			> b
				&:after
					content ':'
					margin-right 8px

			&:last-child
				margin-left auto
				margin-right 0

	> .stats
		display flex
		justify-content space-between
		margin-bottom 16px

		> div
			flex 1
			margin-right 16px
			color var(--adminDashboardCardFg)
			box-shadow 0 2px 4px rgba(0, 0, 0, 0.1)
			background var(--adminDashboardCardBg)
			border-radius 8px

			&:last-child
				margin-right 0

			> div:first-child
				display flex
				align-items center
				text-align center

				&:last-child
					margin-right 0

				> div:first-child
					padding 16px 24px
					font-size 28px

				> div:last-child
					flex 1
					padding 16px 32px 16px 0
					text-align right

					> span
						font-size 70%
						opacity 0.7

					> b
						display block

			> div:last-child
				display flex
				padding 6px 16px
				border-top solid 1px var(--adminDashboardCardDivider)

				> span
					font-size 70%
					opacity 0.7

					&:last-child
						margin-left auto
						cursor pointer

		@media (max-width 900px)
			display grid
			grid-template-columns 1fr 1fr
			grid-template-rows 1fr 1fr
			gap 16px

			> div
				margin-right 0

		@media (max-width 500px)
			display block

			> div:not(:last-child)
				margin-bottom 16px

	> .charts
		margin-bottom 16px

	> .queue
		margin-bottom 16px

	> .cpu-memory
		margin-bottom 16px
</style>
