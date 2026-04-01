<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount, tick } from 'svelte';
	import {
		mdiAlertOutline,
		mdiBike,
		mdiBusDoubleDecker,
		mdiClockOutline,
		mdiCurrencyGbp,
		mdiDatabaseSearchOutline,
		mdiFilePdfBox,
		mdiGoogleMaps,
		mdiMapMarkerPath,
		mdiMapSearchOutline,
		mdiShareVariantOutline,
		mdiShieldCheckOutline,
		mdiTrain,
		mdiWalk
	} from '@mdi/js';
	import openStreetMapLogo from '$lib/assets/openstreetmap.svg';
	import tflLogo from '$lib/assets/transportforlondon.svg';
	import { getDayPalette } from '$lib/services/planner/day-colors';
	import { fullnessMultiplier } from '$lib/services/planner/day-settings';
	import {
		describeLegTextRuns,
		predictedTflCostLabel,
		transportPreferenceSummary
	} from '$lib/services/planner/journey-presentation';
	import { buildSharedPlannerUrl } from '$lib/services/share/planner-share';
	import { formatDuration, parseTimeToMinutes } from '$lib/services/utils';
	import type { PlannerInput, PlannerResult, RouteSegment, SegmentLeg } from '$lib/types/planner';
	import AppIcon from './AppIcon.svelte';
	import ItineraryMap from './ItineraryMap.svelte';

	type DistanceUnit = 'metric' | 'imperial';

	const DISTANCE_UNIT_STORAGE_KEY = 'planner.distanceUnit';
	const KM_TO_MILES = 0.621371;
	const LINE_COLOUR_KEYS = new Set([
		'tube',
		'overground',
		'dlr',
		'bus',
		'tram',
		'national-rail',
		'bakerloo',
		'central',
		'circle',
		'district',
		'hammersmith-city',
		'jubilee',
		'metropolitan',
		'northern',
		'piccadilly',
		'victoria',
		'waterloo-city',
		'elizabeth',
		'liberty',
		'lioness',
		'mildmay',
		'suffragette',
		'weaver',
		'windrush'
	]);

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

	function formatDistance(distanceKm: number | null | undefined): string {
		const safeDistanceKm = Number.isFinite(distanceKm) ? Number(distanceKm) : 0;

		if (distanceUnit === 'imperial') {
			return `${(safeDistanceKm * KM_TO_MILES).toFixed(2)} mi`;
		}

		return `${safeDistanceKm.toFixed(2)} km`;
	}

	function hasDistance(distanceKm: number | null | undefined): boolean {
		return Number.isFinite(distanceKm) && Number(distanceKm) > 0;
	}

	function formatFare(fareGbp: number | null | undefined): string | null {
		if (!Number.isFinite(fareGbp) || fareGbp === null || fareGbp === undefined || fareGbp <= 0) {
			return null;
		}

		return `£${fareGbp.toFixed(2)}`;
	}

	function iconPathForLeg(leg: SegmentLeg): string {
		if (leg.mode === 'cycle') {
			return mdiBike;
		}

		if (leg.mode === 'walk') {
			return mdiWalk;
		}

		const lineType = leg.lineIdentifier?.type?.toLowerCase() ?? '';
		if (lineType.includes('bus')) {
			return mdiBusDoubleDecker;
		}

		return mdiTrain;
	}

	function legLabel(leg: SegmentLeg): string {
		if (leg.mode === 'walk') {
			return 'Walk';
		}

		if (leg.mode === 'cycle') {
			return 'Cycle';
		}

		return leg.lineIdentifier?.name || leg.lineIdentifier?.id || 'Transit';
	}

	function sourceMeta(source: string): {
		label: string;
		logo?: string;
		accentClass: string;
		iconPath?: string;
	} {
		if (source === 'tfl') {
			return {
				label: 'TfL',
				logo: tflLogo,
				accentClass: 'source-chip-tfl'
			};
		}

		if (source === 'openrouteservice') {
			return {
				label: 'OpenStreet',
				logo: openStreetMapLogo,
				accentClass: 'source-chip-osm'
			};
		}

		return {
			label: 'Heuristic',
			accentClass: 'source-chip-heuristic',
			iconPath: mdiMapMarkerPath
		};
	}

	function sourceList(result: PlannerResult): string[] {
		const sources = new Set<string>();
		for (const visit of result.itinerary) {
			if (visit.travelFromPrevious?.source) {
				sources.add(visit.travelFromPrevious.source);
			}
		}

		return Array.from(sources);
	}

	function lineColourKey(leg: SegmentLeg): string | null {
		const aliases: Record<string, string> = {
			'elizabeth-line': 'elizabeth',
			'london-overground': 'overground',
			'public-bus': 'bus',
			'train': 'national-rail'
		};

		const candidates = [leg.lineIdentifier?.id, leg.lineIdentifier?.type];

		for (const candidate of candidates) {
			const normalized = candidate?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
			const mapped = normalized ? aliases[normalized] ?? normalized : null;
			if (mapped && LINE_COLOUR_KEYS.has(mapped)) {
				return mapped;
			}
		}

		return null;
	}

	function lineDotClass(leg: SegmentLeg): string {
		const key = lineColourKey(leg);
		return key ? `bg-${key}` : 'bg-slate-400';
	}

	function detailDistance(leg: SegmentLeg): string | null {
		if (!hasDistance(leg.distanceKm)) {
			return null;
		}

		return formatDistance(leg.distanceKm);
	}

	function segmentDistance(segment: RouteSegment): string {
		if (!hasDistance(segment.distanceKm)) {
			return 'Distance unavailable';
		}

		return formatDistance(segment.distanceKm);
	}

	function requestedSourceLabel(): string {
		switch (input?.settings.dataSource ?? 'auto') {
			case 'tfl':
				return 'TfL';
			case 'openstreet':
				return 'OpenStreet';
			case 'heuristic':
				return 'Heuristic';
			default:
				return 'Recommended';
		}
	}

	function googleMapsTravelMode(segment: RouteSegment): 'walking' | 'bicycling' | 'transit' {
		if (segment.legs.some((leg) => leg.mode === 'transit')) {
			return 'transit';
		}

		if (segment.legs.some((leg) => leg.mode === 'cycle')) {
			return 'bicycling';
		}

		return 'walking';
	}

	function googleMapsHref(segment: RouteSegment): string {
		const query = new URLSearchParams({
			api: '1',
			origin: `${segment.fromLocation.lat},${segment.fromLocation.lng}`,
			destination: `${segment.toLocation.lat},${segment.toLocation.lng}`,
			travelmode: googleMapsTravelMode(segment)
		});

		return `https://www.google.com/maps/dir/?${query.toString()}`;
	}

	function pillTitle(label: string, detail?: string): string {
		return detail ? `${label}: ${detail}` : label;
	}

	function dayUsageStatus(usedMinutes: number, targetMinutes: number): 'light' | 'full' | 'over capacity' {
		if (usedMinutes > targetMinutes) {
			return 'over capacity';
		}

		if (usedMinutes >= targetMinutes * 0.7) {
			return 'full';
		}

		return 'light';
	}

	function dayUsageClasses(status: 'light' | 'full' | 'over capacity'): string {
		switch (status) {
			case 'over capacity':
				return 'border-rose-200 bg-rose-50 text-rose-900';
			case 'full':
				return 'border-amber-200 bg-amber-50 text-amber-950';
			default:
				return 'border-emerald-200 bg-emerald-50 text-emerald-900';
		}
	}

	function buildDaySummaries(result: PlannerResult) {
		return result.planningDays.map((day, dayIndex) => {
			const visits = result.itinerary.filter((visit) => visit.dayIndex === dayIndex);
			const stops = visits.filter((visit) => visit.visitType === 'place').length;
			const usedMinutes = visits.reduce(
				(total, visit) => total + visit.dwellMinutes + (visit.travelFromPrevious?.totalMinutes ?? 0),
				0
			);
			const spanMinutes = Math.max(1, parseTimeToMinutes(day.dayEnd) - parseTimeToMinutes(day.dayStart));
			const targetMinutes = Math.round(spanMinutes * (result.planningDays.length > 1 ? fullnessMultiplier(day.fullness) : 1));
			const status = dayUsageStatus(usedMinutes, targetMinutes);

			return {
				id: day.id,
				label: day.label,
				date: day.date,
				stops,
				usedMinutes,
				targetMinutes,
				status
			};
		});
	}

	function planningDayForIndex(result: PlannerResult, dayIndex: number) {
		return result.planningDays[dayIndex] ?? result.planningDays[0];
	}

	function dayThemeStyle(result: PlannerResult, dayIndex: number, emphasis: 'soft' | 'strong' = 'soft'): string {
		const planningDay = planningDayForIndex(result, dayIndex);
		const palette = getDayPalette(planningDay?.palette);
		return `--day-bg:${emphasis === 'strong' ? palette.surfaceStrong : palette.surface};--day-border:${palette.border};--day-text:${palette.text};--day-muted:${palette.muted};`;
	}

	function dayWindowLabel(result: PlannerResult, dayIndex: number): string {
		const planningDay = planningDayForIndex(result, dayIndex);
		return planningDay ? `${planningDay.dayStart} to ${planningDay.dayEnd}` : '';
	}

	function statusLabel(result: PlannerResult): string {
		return result.feasible ? 'Ready to follow' : 'Needs changes';
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
		<div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
			<div class="flex items-start gap-3">
				<span class="pt-0.5 text-amber-700">
					<AppIcon path={mdiAlertOutline} size={18} decorative={true} />
				</span>
				<div>
					<p class="font-semibold">Check live travel conditions before you leave</p>
					<p class="mt-1 text-sm">
						This itinerary is based on the latest data available to the planner, but you should still confirm timings,
						closures, and platform details in the TfL app or your maps app on the day.
					</p>
					{#if !previewMode && shareEnabled}
						<p class="mt-2 text-sm text-amber-900">
							Share links are serverless and include your hotel, stops, timings, and itinerary data directly in the URL.
						</p>
					{/if}
				</div>
			</div>
		</div>

		<div class="mt-4 space-y-3">
			<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
				<div class="summary-card summary-card-primary">
					<p class="summary-label">Travel Time</p>
					<p class="summary-value">{formatDuration(result.totalTravelMinutes)}</p>
					<p class="summary-note">Total time spent moving between stops.</p>
				</div>
				<div class="summary-card summary-card-primary">
					<p class="summary-label">Dwell Time</p>
					<p class="summary-value">{formatDuration(result.totalDwellMinutes)}</p>
					<p class="summary-note">Planned time spent at places.</p>
				</div>
				<div class="summary-card summary-card-primary">
					<p class="summary-label">Trip Days</p>
					<p class="summary-value">{result.daysUsed} of {result.planningDays.length}</p>
					<p class="summary-note">Days currently used by the itinerary.</p>
				</div>
				<div class="summary-card summary-card-primary">
					<p class="summary-label">Predicted Cost</p>
					<p class="summary-value">{predictedTflCostLabel(result)}</p>
					<p class="summary-note">Summed from available TfL fare data only.</p>
				</div>
			</div>

			<div class="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-stretch">
				<div class="grid gap-2.5 sm:grid-cols-3">
					<div class="summary-card summary-card-secondary">
						<p class="summary-label">Mode</p>
						<p class="summary-value summary-value-secondary">{transportPreferenceSummary(result.modeUsed, result.preferencesUsed)}</p>
					</div>
					<div class="summary-card summary-card-secondary">
						<p class="summary-label">Data Source</p>
						<p class="summary-value summary-value-secondary">{requestedSourceLabel()}</p>
					</div>
					<div class="summary-card summary-card-secondary">
						<p class="summary-label">Status</p>
						<p class="summary-value summary-value-secondary">{statusLabel(result)}</p>
					</div>
				</div>

				{#if sourceList(result).length > 0}
					<div class="summary-card summary-card-secondary min-w-0 lg:min-w-60">
						<p class="summary-label">Route Sources</p>
						<div class="mt-1.5 flex flex-wrap gap-1.5">
							{#each sourceList(result) as source}
								{@const sourceBrand = sourceMeta(source)}
								<span class={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${sourceBrand.accentClass}`}>
									{#if sourceBrand.logo}
										<img src={sourceBrand.logo} alt="" class="h-3.5 w-3.5 rounded-full bg-white p-0.5" />
									{:else if sourceBrand.iconPath}
										<AppIcon path={sourceBrand.iconPath} size={14} label={sourceBrand.label} />
									{/if}
									{sourceBrand.label}
								</span>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>

		<div class="mt-4 flex flex-wrap gap-2" aria-label="Trip day summary">
			{#each buildDaySummaries(result) as daySummary}
				<div
					title={pillTitle(daySummary.label, `${daySummary.stops} stops • ${formatDuration(daySummary.usedMinutes)} planned against ${formatDuration(daySummary.targetMinutes)} target`)}
					class={`rounded-full border px-3 py-2 text-sm font-medium ${dayUsageClasses(daySummary.status)}`}
				>
					<span class="font-semibold">{daySummary.label}</span>
					<span class="mx-1 text-current/70">•</span>
					<span>{daySummary.stops} stop{daySummary.stops === 1 ? '' : 's'}</span>
					<span class="mx-1 text-current/70">•</span>
					<span>{daySummary.status}</span>
				</div>
			{/each}
		</div>

		<div class="mt-4 flex flex-wrap items-center gap-2">
			<button
				type="button"
				class="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
				onclick={toggleMapPanel}
				aria-pressed={showMap}
			>
				<AppIcon path={mdiMapSearchOutline} size={16} decorative={true} />
				{showMap ? 'Hide map panel' : 'View on map'}
			</button>
			{#if !previewMode && onExportPdf}
				<button
					type="button"
					class="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
					onclick={onExportPdf}
				>
					<AppIcon path={mdiFilePdfBox} size={16} decorative={true} />
					Export as PDF
				</button>
			{/if}
			{#if shareEnabled}
				<button
					type="button"
					class="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
					onclick={copyShareLink}
				>
					<AppIcon path={mdiShareVariantOutline} size={16} decorative={true} />
					Copy share link
				</button>
			{/if}
		</div>

		{#if shareStatus}
			<p class="mt-3 text-sm text-slate-700" role="status" aria-live="polite">{shareStatus}</p>
		{/if}

		<ol class="mt-4 space-y-3">
			{#each result.itinerary as visit, index}
				{@const planningDay = planningDayForIndex(result, visit.dayIndex)}
				{#if index === 0 || result.itinerary[index - 1]?.dayIndex !== visit.dayIndex}
					{#if index > 0}
						<li class="px-2" aria-hidden="true">
							<div class="day-divider"></div>
						</li>
					{/if}
					<li class="day-break-card rounded-xl border p-3" style={dayThemeStyle(result, visit.dayIndex, 'strong')}>
						<p class="text-xs font-semibold uppercase tracking-[0.18em] day-muted">{visit.dayLabel}</p>
						<p class="mt-1 text-base font-semibold day-text">{planningDay?.date ?? visit.dayDate ?? 'Date not set'}</p>
						<p class="mt-1 text-sm day-muted">{dayWindowLabel(result, visit.dayIndex)}</p>
					</li>
				{/if}
				{#if visit.travelFromPrevious}
					{@const segment = visit.travelFromPrevious}
					{@const brand = sourceMeta(segment.source)}
					<li class="day-journey-card rounded-2xl border p-4 text-sm shadow-sm" style={dayThemeStyle(result, visit.dayIndex)}>
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div>
								<p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
									{visit.visitType === 'return' ? 'Journey back to hotel' : `Journey to ${visit.placeName}`}
								</p>
								<p class="mt-1 text-base font-semibold text-slate-900">{segment.fromName} to {segment.toName}</p>
							</div>
							<div class="flex flex-wrap items-center gap-2">
								<span title={pillTitle('Route source', brand.label)} class={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${brand.accentClass}`}>
									{#if brand.logo}
										<img src={brand.logo} alt="" class="h-4 w-4 rounded-full bg-white p-0.5" />
									{:else if brand.iconPath}
										<AppIcon path={brand.iconPath} size={16} label={brand.label} />
									{/if}
									{brand.label}
								</span>
								<span title={pillTitle('Duration', formatDuration(segment.totalMinutes))} class="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
									<AppIcon path={mdiClockOutline} size={14} label="Duration" />
									{formatDuration(segment.totalMinutes)}
								</span>
								<span title={pillTitle('Distance', segmentDistance(segment))} class="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
									<AppIcon path={mdiMapMarkerPath} size={14} label="Distance" />
									{segmentDistance(segment)}
								</span>
								{#if formatFare(segment.fareGbp)}
									<span title={pillTitle('Fare', formatFare(segment.fareGbp) ?? '')} class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
										<AppIcon path={mdiCurrencyGbp} size={14} label="Fare" />
										{formatFare(segment.fareGbp)}
									</span>
								{/if}
								<a
									href={googleMapsHref(segment)}
									target="_blank"
									rel="noreferrer"
									title={pillTitle('Open in Google Maps', `${segment.fromName} to ${segment.toName}`)}
									class="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
								>
									<AppIcon path={mdiGoogleMaps} size={14} label="Google Maps" />
									Google Maps
								</a>
							</div>
						</div>

						<div class="mt-4 flex flex-wrap items-center gap-2">
							{#each segment.legs as leg, index}
								<div title={pillTitle(legLabel(leg), `${formatDuration(leg.minutes)}${detailDistance(leg) ? ` • ${detailDistance(leg)}` : ''}`)} class="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-slate-800 ring-1 ring-slate-200">
									<span class={`inline-flex h-7 w-7 items-center justify-center rounded-full ${leg.mode === 'transit' ? 'bg-slate-100 text-slate-900' : 'bg-teal-50 text-teal-800'}`}>
										<AppIcon path={iconPathForLeg(leg)} size={16} label={legLabel(leg)} />
									</span>
									<span class="flex flex-col leading-tight">
										<span class="font-medium text-slate-900">{legLabel(leg)}</span>
										<span class="text-xs text-slate-600">{formatDuration(leg.minutes)}{#if detailDistance(leg)} • {detailDistance(leg)}{/if}</span>
									</span>
									{#if leg.mode === 'transit' && lineColourKey(leg)}
										<span class={`h-2.5 w-2.5 rounded-full ${lineDotClass(leg)}`}></span>
									{/if}
								</div>
								{#if index < segment.legs.length - 1}
									<span class="text-slate-400" aria-hidden="true">→</span>
								{/if}
							{/each}
						</div>

						<div class="mt-4 rounded-xl border border-slate-200 bg-white p-3">
							<p class="text-sm font-medium text-slate-900">Journey details</p>
							<ul class="mt-2 space-y-2 text-sm text-slate-700">
								{#each segment.legs as leg}
									<li class="flex items-start gap-3">
										<span class={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${leg.mode === 'transit' ? lineDotClass(leg) : 'bg-teal-600'}`}></span>
										<div>
											<p>
												{#each describeLegTextRuns(leg) as run}
													{#if run.highlight}
														<strong>{run.text}</strong>
													{:else}
														{run.text}
													{/if}
												{/each}
											</p>
											<p class="text-xs text-slate-500">{formatDuration(leg.minutes)}{#if detailDistance(leg)} • {detailDistance(leg)}{/if}</p>
										</div>
									</li>
								{/each}
							</ul>
						</div>

						{#if (visit.freeTimeBeforeVisitMinutes ?? 0) > 0}
							<p class="mt-3 text-slate-700">
								You have {formatDuration(visit.freeTimeBeforeVisitMinutes ?? 0)} of free time before this stop. Stay nearby and leave by
								<strong>{visit.recommendedLeaveByTime}</strong>.
							</p>
						{/if}
					</li>
				{/if}

				<li class="day-stop-card rounded-xl border p-3" style={dayThemeStyle(result, visit.dayIndex)}>
					{#if visit.visitType === 'return'}
						<p class="font-semibold day-text">{visit.arrivalTime} | Back at {visit.placeName}</p>
						<p class="mt-1 text-sm day-muted">Final return to your hotel or starting point.</p>
					{:else}
						<p class="font-semibold day-text">{visit.arrivalTime} - {visit.departureTime} | {visit.placeName}</p>
						<p class="mt-1 text-sm day-muted">Dwell: {formatDuration(visit.dwellMinutes)}</p>
					{/if}
				</li>
			{/each}
		</ol>

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

<style>
	.source-chip-tfl {
		background: #113b92;
		color: #fff;
	}

	.source-chip-osm {
		background: #7ebc6f;
		color: #0f172a;
	}

	.source-chip-heuristic {
		background: #0f172a;
		color: #fff;
	}

	.summary-card {
		border-radius: 1rem;
		border: 1px solid #cbd5e1;
		background: #fff;
	}

	.summary-card-primary {
		padding: 1rem;
		background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
		box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
	}

	.summary-card-secondary {
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-height: 4.5rem;
		padding: 0.55rem 0.75rem;
		background: #f8fafc;
	}

	.summary-label {
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #475569;
	}

	.summary-value {
		margin-top: 0.35rem;
		font-size: 1.25rem;
		font-weight: 700;
		line-height: 1.25;
		color: #0f172a;
	}

	.summary-value-secondary {
		font-size: 0.8rem;
		font-weight: 500;
		line-height: 1.3;
	}

	.summary-note {
		margin-top: 0.25rem;
		font-size: 0.82rem;
		line-height: 1.4;
		color: #64748b;
	}

	.day-break-card,
	.day-journey-card,
	.day-stop-card {
		background: var(--day-bg);
		border-color: var(--day-border);
	}

	.day-text {
		color: var(--day-text);
	}

	.day-muted {
		color: var(--day-muted);
	}

	.day-divider {
		height: 1px;
		background: linear-gradient(90deg, transparent 0%, #cbd5e1 12%, #cbd5e1 88%, transparent 100%);
	}
</style>
