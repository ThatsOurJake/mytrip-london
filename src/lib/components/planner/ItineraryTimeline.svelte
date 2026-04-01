<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount, tick } from 'svelte';
	import { buildSharedPlannerUrl } from '$lib/services/share/planner-share';
	import type { PlannerInput, PlannerResult } from '$lib/types/planner';
	import ItineraryMap from './ItineraryMap.svelte';
	import ItinerarySummary from '$lib/components/planner/ItinerarySummary.svelte';
	import ItineraryVisitList from '$lib/components/planner/ItineraryVisitList.svelte';
	import type { DistanceUnit } from '$lib/components/planner/itinerary-ui';

	const DISTANCE_UNIT_STORAGE_KEY = 'planner.distanceUnit';

	let {
		input,
		result,
		shareEnabled = true,
		previewMode = false,
		onExportPdf
	}: {
		input: PlannerInput | null;
		result: PlannerResult | null;
		shareEnabled?: boolean;
		previewMode?: boolean;
		onExportPdf?: (() => void) | undefined;
	} = $props();

	let distanceUnit = $state<DistanceUnit>('metric');
	let shareStatus = $state('');
	let showMap = $state(false);
	let mapPanelElement = $state<HTMLDivElement | null>(null);
	let timelineElement = $state<HTMLElement | null>(null);

	onMount(() => {
		if (!browser) {
			return;
		}

		const stored = localStorage.getItem(DISTANCE_UNIT_STORAGE_KEY);
		if (stored === 'metric' || stored === 'imperial') {
			distanceUnit = stored;
		}
	});

	async function copyShareLink(): Promise<void> {
		if (!browser || !shareEnabled || !input || !result) {
			return;
		}

		const shareUrl = buildSharedPlannerUrl(window.location.origin, input, result);

		try {
			await navigator.clipboard.writeText(shareUrl);
			shareStatus = 'Share link copied. It includes hotel, stops, timings, and itinerary data in the URL.';
		} catch {
			window.prompt('Copy this share link', shareUrl);
			shareStatus = 'Share link ready. It includes hotel, stops, timings, and itinerary data in the URL.';
		}
	}

	async function toggleMapPanel(): Promise<void> {
		showMap = !showMap;

		if (showMap) {
			await tick();
			mapPanelElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	function scrollToTimelineTop(): void {
		timelineElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function setDistanceUnit(unit: DistanceUnit): void {
		distanceUnit = unit;
		if (!browser) {
			return;
		}

		localStorage.setItem(DISTANCE_UNIT_STORAGE_KEY, unit);
	}
</script>

<section bind:this={timelineElement} aria-labelledby="timeline-title" class="rounded-2xl border border-slate-300 bg-white/90 p-5 shadow-sm">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h2 id="timeline-title" class="text-xl font-semibold text-slate-900">Itinerary</h2>
		<div class="flex flex-wrap items-center gap-2">
			<div class="inline-flex items-center gap-2" role="group" aria-label="Distance unit">
				<span class="text-sm font-medium text-slate-700">Distance:</span>
				<button
					type="button"
					class={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${distanceUnit === 'metric' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
					onclick={() => setDistanceUnit('metric')}
					aria-pressed={distanceUnit === 'metric'}
				>
					Metric
				</button>
				<button
					type="button"
					class={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${distanceUnit === 'imperial' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
					onclick={() => setDistanceUnit('imperial')}
					aria-pressed={distanceUnit === 'imperial'}
				>
					Imperial
				</button>
			</div>
		</div>
	</div>

	{#if !result || !input}
		<p class="mt-3 text-sm text-slate-600">Optimise to generate a timed itinerary.</p>
	{:else}
		<ItinerarySummary
			{input}
			{result}
			{distanceUnit}
			{previewMode}
			{shareEnabled}
			{shareStatus}
			{showMap}
			onSetDistanceUnit={setDistanceUnit}
			onToggleMap={toggleMapPanel}
			onCopyShareLink={copyShareLink}
			{onExportPdf}
		/>

		<ItineraryVisitList {input} {result} {distanceUnit} />

		{#if showMap}
			<div bind:this={mapPanelElement} class="mt-5">
				<ItineraryMap {input} {result} />
			</div>
		{/if}

		<div class="mt-5 flex justify-end">
			<button type="button" class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100" onclick={scrollToTimelineTop}>
				Back to itinerary top
			</button>
		</div>
	{/if}
</section>
