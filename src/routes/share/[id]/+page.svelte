<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { mdiAlertOutline, mdiLoading, mdiMapMarkerPath, mdiShareVariantOutline } from '@mdi/js';
	import {
		AppIcon,
		ConflictPanel,
		ItineraryTimeline,
		PRIMARY_BUTTON_CLASS,
		SECONDARY_BUTTON_CLASS
	} from '$lib/components/planner';
	import { transportPreferenceSummary } from '$lib/services/planner/journey-presentation';
	import { clearPlannerRouteCache, runPlanner } from '$lib/services/planner/run-planner';
	import { routeDataSourceLabel } from '$lib/services/planner/ui-text';
	import { readCachedSharedTrip, writeCachedSharedTrip } from '$lib/services/share/share-cache';
	import type { SharedPlannerState } from '$lib/services/share/share-types';
	import type { PlannerResult } from '$lib/types/planner';

	let {
		data
	}: {
		data: {
			shareId: string;
			payload: SharedPlannerState | null;
			errorMessage: string | null;
		};
	} = $props();
	let result = $state<PlannerResult | null>(null);
	let generatedAt = $state<string | null>(null);
	let isCheckingCache = $state(true);
	let isGenerating = $state(false);
	let statusMessage = $state('');

	const sharedInput = $derived(data.payload?.input ?? null);
	const tripName = $derived(sharedInput?.settings.tripName?.trim() || 'Shared trip');
	const planningDays = $derived(sharedInput?.settings.planningDays ?? []);

	function formatTimestamp(value: string | null): string | null {
		if (!value) {
			return null;
		}

		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) {
			return null;
		}

		return new Intl.DateTimeFormat('en-GB', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(parsed);
	}

	onMount(async () => {
		if (!data.payload) {
			isCheckingCache = false;
			return;
		}

		try {
			const cached = await readCachedSharedTrip(data.shareId);
			if (cached) {
				result = cached.result;
				generatedAt = cached.generatedAt;
				statusMessage = 'Loaded the last generated itinerary from this browser cache.';
			}
		} catch {
			statusMessage = 'This browser could not read the local share cache, so itinerary details need to be generated here.';
		} finally {
			isCheckingCache = false;
		}
	});

	async function generateItinerary(): Promise<void> {
		if (!sharedInput || isGenerating) {
			return;
		}

		isGenerating = true;
		statusMessage = 'Generating itinerary details for this shared trip...';

		try {
			clearPlannerRouteCache();
			const nextResult = await runPlanner(sharedInput);
			const nextGeneratedAt = new Date().toISOString();

			result = nextResult;
			generatedAt = nextGeneratedAt;
			statusMessage = 'Itinerary generated and cached in this browser for later visits.';

			await writeCachedSharedTrip({
				shareId: data.shareId,
				input: sharedInput,
				result: nextResult,
				generatedAt: nextGeneratedAt
			});
		} catch (error) {
			statusMessage = error instanceof Error ? error.message : 'Failed to generate itinerary details for this shared trip.';
		} finally {
			isGenerating = false;
		}
	}

	async function copyShareLink(): Promise<void> {
		if (!browser) {
			return;
		}

		const shareUrl = window.location.href;

		try {
			await navigator.clipboard.writeText(shareUrl);
			statusMessage = 'Share link copied to the clipboard.';
		} catch {
			window.prompt('Copy this share link', shareUrl);
			statusMessage = 'Share link ready to copy.';
		}
	}
</script>

<svelte:head>
	<title>{tripName} · My Trip · London</title>
	<meta name="description" content="Open and generate a shared London itinerary in your browser." />
</svelte:head>

<main class="mx-auto max-w-7xl px-4 py-8 md:px-8">
	<header class="rounded-3xl border border-slate-300 bg-white/90 p-6 shadow-sm">
		<p class="text-sm font-semibold uppercase tracking-wider text-brand">mytrip.london</p>
		<h1 class="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">{tripName}</h1>
		<p class="mt-3 max-w-3xl text-slate-700">
			Open this shared trip, then generate the itinerary details in your browser. If you revisit on
			the same device, the last generated version is loaded from local cache and may be stale.
		</p>

		{#if data.payload}
			<div class="mt-4 flex flex-wrap gap-2 text-sm text-slate-700">
				<span class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium">
					<AppIcon path={mdiMapMarkerPath} size={14} decorative={true} />
					{data.payload.input.places.length} stop{data.payload.input.places.length === 1 ? '' : 's'}
				</span>
				<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium">
					{planningDays.length || 1} day{(planningDays.length || 1) === 1 ? '' : 's'}
				</span>
				<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium">
					{transportPreferenceSummary(data.payload.input.settings.mode, data.payload.input.settings.preferences ?? ['walking'])}
				</span>
				<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium">
					{routeDataSourceLabel(data.payload.input.settings.dataSource)} routing
				</span>
				<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium">
					Hotel: {data.payload.input.hotel.name}
				</span>
			</div>

			<div class="mt-5 flex flex-wrap items-center gap-3">
				<button type="button" class={SECONDARY_BUTTON_CLASS} onclick={copyShareLink}>
					<AppIcon path={mdiShareVariantOutline} size={16} decorative={true} />
					Share this trip
				</button>
				{#if !result}
					<button type="button" class={PRIMARY_BUTTON_CLASS} onclick={generateItinerary} disabled={isGenerating || isCheckingCache}>
						{#if isGenerating}
							<span class="share-loading-icon inline-flex">
								<AppIcon path={mdiLoading} size={18} decorative={true} />
							</span>
							Generating itinerary
						{:else}
							Generate itinerary
						{/if}
					</button>
				{/if}
			</div>

			{#if statusMessage}
				<p class="mt-3 text-sm text-slate-700" role="status" aria-live="polite">{statusMessage}</p>
			{/if}
		{:else}
			<div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
				<div class="flex items-start gap-3">
					<span class="pt-0.5 text-amber-700">
						<AppIcon path={mdiAlertOutline} size={18} decorative={true} />
					</span>
					<div>
						<p class="font-semibold">Unable to load shared trip</p>
						<p class="mt-1 text-sm">{data.errorMessage}</p>
					</div>
				</div>
			</div>
		{/if}
	</header>

	{#if data.payload && result}
		<div class="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
			<div class="flex items-start gap-3">
				<span class="pt-0.5 text-amber-700">
					<AppIcon path={mdiAlertOutline} size={18} decorative={true} />
				</span>
				<div>
					<p class="font-semibold">Cached itinerary details</p>
					<p class="mt-1 text-sm">
						This itinerary was generated in this browser {#if formatTimestamp(generatedAt)} on {formatTimestamp(generatedAt)}{/if}. Travel data can go stale, so confirm live conditions before you travel.
					</p>
				</div>
			</div>
		</div>

		<section class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
			<div class="min-w-0 space-y-6">
				<ItineraryTimeline input={data.payload.input} {result} shareEnabled={false} previewMode={true} />
			</div>
			<div class="min-w-0 space-y-6">
				<ConflictPanel {result} />
			</div>
		</section>
	{:else if data.payload && !isCheckingCache}
		<section class="mt-6 rounded-2xl border border-slate-300 bg-white/90 p-6 shadow-sm">
			<h2 class="text-xl font-semibold text-slate-900">Generate itinerary details</h2>
			<p class="mt-2 max-w-3xl text-slate-700">
				This shared link keeps the hotel, stop constraints, trip days, transport preferences, and route source compact in the URL. Journey timings and route details are generated here when you need them.
			</p>
		</section>
	{/if}
</main>

<style>
	.share-loading-icon {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}

		to {
			transform: rotate(360deg);
		}
	}
</style>
