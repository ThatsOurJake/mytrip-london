<script lang="ts">
	import type { PlannerResult } from '$lib/types/planner';

	let { result }: { result: PlannerResult | null } = $props();

	function informationalWarnings(result: PlannerResult) {
		return result.warnings.filter((warning) => warning.type === 'unscheduled');
	}

	function standardWarnings(result: PlannerResult) {
		return result.warnings.filter((warning) => warning.type !== 'unscheduled');
	}
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

		{#if informationalWarnings(result).length > 0}
			<h3 class="mt-4 text-sm font-semibold text-sky-900">Info</h3>
			<ul class="mt-2 space-y-2">
				{#each informationalWarnings(result) as warning}
					<li class="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">{warning.message}</li>
				{/each}
			</ul>
		{/if}

		{#if standardWarnings(result).length > 0}
			<h3 class="mt-4 text-sm font-semibold text-amber-900">Warnings</h3>
			<ul class="mt-2 space-y-2">
				{#each standardWarnings(result) as warning}
					<li class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{warning.message}</li>
				{/each}
			</ul>
			<div class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
				<p class="font-semibold text-slate-900">Warning guide</p>
				<ul class="mt-2 space-y-2 list-none pl-0">
					<li>Tight timing means the stop has very little room before closing or before a booked arrival time.</li>
					<li>Preferred-day warnings mean the planner had to place a stop on a different day.</li>
					<li>Overnight warnings mean a fixed-time visit was moved to a later day to avoid missing it.</li>
					<li>Day-end warnings mean the visit runs past the target finish time without breaking an explicit time rule.</li>
					<li>Shortened-dwell warnings mean a booked visit starts on time but the place closes before the full stay can be completed.</li>
				</ul>
			</div>
		{/if}
	{/if}
</section>
