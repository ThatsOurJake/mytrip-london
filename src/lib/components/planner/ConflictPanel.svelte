<script lang="ts">
	import type { PlannerResult } from '$lib/types/planner';

	let { result }: { result: PlannerResult | null } = $props();
</script>

<section aria-labelledby="conflicts-title" class="rounded-2xl border border-slate-300 bg-white/90 p-5 shadow-sm">
	<h2 id="conflicts-title" class="text-xl font-semibold text-slate-900">Conflicts and warnings</h2>

	{#if !result}
		<p class="mt-3 text-sm text-slate-600">No analysis yet.</p>
	{:else}
		{#if result.conflicts.length === 0}
			<p class="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">No hard conflicts found.</p>
		{:else}
			<ul class="mt-3 space-y-2" aria-live="polite">
				{#each result.conflicts as conflict}
					<li class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{conflict.message}</li>
				{/each}
			</ul>
		{/if}

		{#if result.warnings.length > 0}
			<h3 class="mt-4 text-sm font-semibold text-amber-900">Warnings</h3>
			<ul class="mt-2 space-y-2">
				{#each result.warnings as warning}
					<li class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{warning.message}</li>
				{/each}
			</ul>
			<div class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
				<p class="font-semibold text-slate-900">Warning guide</p>
				<p>
					Tight timing means the stop has very little room for delays before the latest allowed arrival. "No arrival
					buffer" means you must arrive exactly on time to avoid a conflict.
				</p>
			</div>
		{/if}
	{/if}
</section>
