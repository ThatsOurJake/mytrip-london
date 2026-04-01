<script lang="ts">
	import { mdiAlertOutline, mdiFilePdfBox, mdiMapSearchOutline, mdiShareVariantOutline } from '@mdi/js';
	import {
		SUMMARY_NOTE_COPY,
		TIME_AT_PLACES_LABEL,
		itineraryStatusLabel,
		routeDataSourceLabel
	} from '$lib/services/planner/ui-text';
	import { formatDuration } from '$lib/services/utils';
	import type { PlannerInput, PlannerResult } from '$lib/types/planner';
	import AppIcon from '../shared/AppIcon.svelte';
	import { SECONDARY_BUTTON_CLASS } from '../shared/button-classes';
	import SeparatorDot from '../shared/SeparatorDot.svelte';
	import { buildDaySummaries, dayUsageClasses, pillTitle, sourceList, sourceMeta, type DistanceUnit } from './itinerary-ui';
	import { predictedTflCostLabel, transportPreferenceSummary } from '$lib/services/planner/journey-presentation';

	let {
		input,
		result,
		distanceUnit,
		previewMode = false,
		shareEnabled = true,
		shareStatus = '',
		showMap = false,
		onSetDistanceUnit,
		onToggleMap,
		onCopyShareLink,
		onExportPdf
	}: {
		input: PlannerInput;
		result: PlannerResult;
		distanceUnit: DistanceUnit;
		previewMode?: boolean;
		shareEnabled?: boolean;
		shareStatus?: string;
		showMap?: boolean;
		onSetDistanceUnit: (unit: DistanceUnit) => void;
		onToggleMap: () => void;
		onCopyShareLink: () => void;
		onExportPdf?: (() => void) | undefined;
	} = $props();
</script>

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
			<p class="summary-note">{SUMMARY_NOTE_COPY.travelTime}</p>
		</div>
		<div class="summary-card summary-card-primary">
			<p class="summary-label">{TIME_AT_PLACES_LABEL}</p>
			<p class="summary-value">{formatDuration(result.totalDwellMinutes)}</p>
			<p class="summary-note">{SUMMARY_NOTE_COPY.timeAtPlaces}</p>
		</div>
		<div class="summary-card summary-card-primary">
			<p class="summary-label">Trip Days</p>
			<p class="summary-value">{result.daysUsed} of {result.planningDays.length}</p>
			<p class="summary-note">{SUMMARY_NOTE_COPY.tripDays}</p>
		</div>
		<div class="summary-card summary-card-primary">
			<p class="summary-label">Predicted Cost</p>
			<p class="summary-value">{predictedTflCostLabel(result)}</p>
			<p class="summary-note">{SUMMARY_NOTE_COPY.predictedCost}</p>
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
				<p class="summary-value summary-value-secondary">{routeDataSourceLabel(input.settings.dataSource)}</p>
			</div>
			<div class="summary-card summary-card-secondary">
				<p class="summary-label">Status</p>
				<p class="summary-value summary-value-secondary">{itineraryStatusLabel(result.feasible)}</p>
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
			<SeparatorDot />
			<span>{daySummary.stops} stop{daySummary.stops === 1 ? '' : 's'}</span>
			<SeparatorDot />
			<span>{daySummary.status}</span>
		</div>
	{/each}
</div>

<div class="mt-4 flex flex-wrap items-center justify-between gap-3">
	<div class="flex flex-wrap items-center gap-2">
		<div class="inline-flex items-center gap-2" role="group" aria-label="Distance unit">
			<span class="text-sm font-medium text-slate-700">Distance:</span>
			<button
				type="button"
				class={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${distanceUnit === 'metric' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
				onclick={() => onSetDistanceUnit('metric')}
				aria-pressed={distanceUnit === 'metric'}
			>
				Metric
			</button>
			<button
				type="button"
				class={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${distanceUnit === 'imperial' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
				onclick={() => onSetDistanceUnit('imperial')}
				aria-pressed={distanceUnit === 'imperial'}
			>
				Imperial
			</button>
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-2">
		<button
			type="button"
			class={SECONDARY_BUTTON_CLASS}
			onclick={onToggleMap}
			aria-pressed={showMap}
		>
			<AppIcon path={mdiMapSearchOutline} size={16} decorative={true} />
			{showMap ? 'Hide map panel' : 'View on map'}
		</button>
		{#if !previewMode && onExportPdf}
			<button
				type="button"
				class={SECONDARY_BUTTON_CLASS}
				onclick={onExportPdf}
			>
				<AppIcon path={mdiFilePdfBox} size={16} decorative={true} />
				Export as PDF
			</button>
		{/if}
		{#if shareEnabled}
			<button
				type="button"
				class={SECONDARY_BUTTON_CLASS}
				onclick={onCopyShareLink}
			>
				<AppIcon path={mdiShareVariantOutline} size={16} decorative={true} />
				Copy share link
			</button>
		{/if}
	</div>
</div>

{#if shareStatus}
	<p class="mt-3 text-sm text-slate-700" role="status" aria-live="polite">{shareStatus}</p>
{/if}

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
</style>
