<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { mdiAlertOutline, mdiOpenInNew } from '@mdi/js';
	import AppIcon from '$lib/components/planner/AppIcon.svelte';
	import { PRIMARY_BUTTON_CLASS } from '$lib/components/planner/button-classes';
	import ConflictPanel from '$lib/components/planner/ConflictPanel.svelte';
	import ItineraryTimeline from '$lib/components/planner/ItineraryTimeline.svelte';
	import { plannerStore } from '$lib/stores';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let importStatus = $state('');

	async function importIntoPlanner(): Promise<void> {
		if (!browser || !data.payload) {
			return;
		}

		const confirmed = window.confirm(
			'Import this shared itinerary into your local planner and replace your current saved plan?'
		);
		if (!confirmed) {
			return;
		}

		plannerStore.importSharedPlan(data.payload.input, data.payload.result);
		importStatus = 'Shared itinerary imported. Redirecting to the planner.';
		await goto('/');
	}
</script>

<svelte:head>
	<title>Shared London Day Planner Preview</title>
</svelte:head>

<main class="mx-auto max-w-7xl px-4 py-8 md:px-8">
	<header class="rounded-3xl border border-slate-300 bg-white/90 p-6 shadow-sm">
		<p class="text-sm font-semibold uppercase tracking-wider text-teal-700">Shared preview</p>
		<h1 class="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">Preview a shared London itinerary</h1>
		<p class="mt-3 max-w-3xl text-slate-700">
			This page is serverless and read-only. It does not touch your saved planner unless you explicitly import the itinerary.
		</p>

		{#if data.payload}
			<div class="mt-4 flex flex-wrap gap-3">
				<button
					type="button"
					class={PRIMARY_BUTTON_CLASS}
					onclick={importIntoPlanner}
				>
					<AppIcon path={mdiOpenInNew} size={18} decorative={true} />
					Import into planner
				</button>
			</div>
			<p class="mt-3 text-sm text-slate-700" role="status" aria-live="polite">{importStatus}</p>
		{:else}
			<div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
				<div class="flex items-start gap-3">
					<span class="rounded-full bg-amber-100 p-2 text-amber-700">
						<AppIcon path={mdiAlertOutline} size={18} decorative={true} />
					</span>
					<div>
						<p class="font-semibold">Unable to load shared itinerary</p>
						<p class="mt-1 text-sm">{data.errorMessage}</p>
					</div>
				</div>
			</div>
		{/if}
	</header>

	{#if data.payload}
		<section class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
			<div class="min-w-0 space-y-6">
				<ItineraryTimeline input={data.payload.input} result={data.payload.result} shareEnabled={false} previewMode={true} />
			</div>
			<div class="min-w-0 space-y-6">
				<ConflictPanel result={data.payload.result} />
			</div>
		</section>
	{/if}
</main>
