<script lang="ts">
	let { toneClass = 'text-current/70' }: { toneClass?: string } = $props();
</script>

<span class={`separator-dot ${toneClass}`} aria-hidden="true">•</span>

<style>
	.separator-dot {
		display: inline-flex;
		align-items: center;
		padding-inline: 0.375rem;
	}
</style>
