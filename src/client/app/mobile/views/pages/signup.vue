<template>
<div class="signup">
	<h1>{{ $t('lets-start') }}</h1>
	<mk-signup/>
</div>
</template>

<script lang="ts">
import Vue from 'vue';
import i18n from '../../../i18n';
export default Vue.extend({
	i18n: i18n('mobile/views/pages/signup.vue')
});
</script>

<style lang="stylus" scoped>
.signup
	padding 32px
	margin 0 auto
	max-width 500px

	h1
		margin 0
		padding 8px 0 0 0
		font-family fot-rodin-pron, a-otf-ud-shin-go-pr6n, sans-serif
		font-size 1.5em
		font-weight 600
		color var(--text)
</style>
