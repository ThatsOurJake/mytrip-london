<script lang="ts">
	import SvgIcon from '@jamescoyle/svelte-icon';

	let {
		path,
		size = 20,
		label,
		decorative = false
	}: {
		path: string;
		size?: number | string;
		label?: string;
		decorative?: boolean;
	} = $props();
</script>

<span class="icon-root" aria-hidden={decorative ? 'true' : undefined}>
	<SvgIcon type="mdi" path={path} size={size} ariaLabel={decorative ? undefined : label} />
</span>

<style>
	.icon-root {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		line-height: 0;
		color: currentColor;
	}

	.icon-root :global(svg) {
		display: block;
	}
</style>
