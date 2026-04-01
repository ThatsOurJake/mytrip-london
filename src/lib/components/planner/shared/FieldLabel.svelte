<script lang="ts">
	import InfoPopover from './InfoPopover.svelte';

	let {
		text,
		infoLabel,
		infoContent
	}: {
		text: string;
		infoLabel?: string;
		infoContent?: string;
	} = $props();
</script>

<span class="field-label">
	<span>{text}</span>
	{#if infoContent}
		<InfoPopover label={infoLabel ?? text} content={infoContent} />
	{/if}
</span>

<style>
	.field-label {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.35;
		color: #334155;
	}
</style>
