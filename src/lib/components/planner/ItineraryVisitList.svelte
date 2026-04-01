<script lang="ts">
	import { mdiClockOutline, mdiCurrencyGbp, mdiGoogleMaps, mdiMapMarkerPath } from '@mdi/js';
	import { plannedStayLabel } from '$lib/services/planner/ui-text';
	import { formatDuration, parseTimeToMinutes } from '$lib/services/utils';
	import type { PlannerInput, PlannerResult } from '$lib/types/planner';
	import AppIcon from './AppIcon.svelte';
	import {
		dayThemeStyle,
		dayWindowLabel,
		detailDistance,
		formatFare,
		googleMapsHref,
		iconPathForLeg,
		legDescription,
		legEndTime,
		legLabel,
		legStartTime,
		lineColourKey,
		lineDotClass,
		lineTextClass,
		pillTitle,
		planningDayForIndex,
		segmentStartTime,
		segmentUsesScheduledLegTimes,
		segmentDistance,
		sourceMeta,
		transitLineName,
		transitStopCountLabel,
		type DistanceUnit
	} from './itinerary-ui';

	let {
		input,
		result,
		distanceUnit
	}: {
		input: PlannerInput;
		result: PlannerResult;
		distanceUnit: DistanceUnit;
	} = $props();
</script>

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
				<div class="compact-stop-row">
					<p class="text-xs font-semibold uppercase tracking-[0.18em] day-muted">{visit.dayLabel}</p>
					<span class="compact-separator" aria-hidden="true">•</span>
					<p class="font-semibold day-text">{planningDay?.date ?? visit.dayDate ?? 'Date not set'}</p>
					<span class="compact-separator" aria-hidden="true">•</span>
					<p class="day-muted">{dayWindowLabel(result, visit.dayIndex)}</p>
				</div>
			</li>
			<li class="day-stop-card rounded-xl border p-3" style={dayThemeStyle(result, visit.dayIndex)}>
				<div class="compact-stop-row">
					<p class="font-semibold day-text">{planningDay?.dayStart ?? visit.arrivalTime}</p>
					<span class="compact-separator" aria-hidden="true">•</span>
					<p class="day-text">Start from {input.hotel.name}</p>
					{#if visit.recommendedLeaveByTime}
						<span class="compact-separator" aria-hidden="true">•</span>
						<p class="day-muted">Leave by {visit.recommendedLeaveByTime}</p>
					{/if}
				</div>
			</li>
		{/if}

		{#if visit.travelFromPrevious}
			{@const segment = visit.travelFromPrevious}
			{@const brand = sourceMeta(segment.source)}
			{@const previousVisit = result.itinerary[index - 1]}
			{@const startName = previousVisit?.dayIndex === visit.dayIndex ? previousVisit.placeName : input.hotel.name}
			{@const destinationName = visit.visitType === 'return' ? input.hotel.name : visit.placeName}
			{@const segmentLeaveTime = segmentStartTime(
				segment,
				visit.arrivalTime,
				visit.recommendedLeaveByTime,
				previousVisit?.dayIndex === visit.dayIndex ? previousVisit.departureTime : undefined
			)}
			{@const useScheduledLegTimes = segmentUsesScheduledLegTimes(segment, segmentLeaveTime, visit.arrivalTime)}
			{#if (visit.freeTimeBeforeVisitMinutes ?? 0) > 0}
				<li class="day-stop-card rounded-xl border p-3" style={dayThemeStyle(result, visit.dayIndex)}>
					<div class="compact-stop-row">
						<p class="font-semibold day-text">Free time before {visit.placeName}</p>
						<span class="compact-separator" aria-hidden="true">•</span>
						<p class="day-muted">{formatDuration(visit.freeTimeBeforeVisitMinutes ?? 0)} free</p>
						{#if visit.recommendedLeaveByTime}
							<span class="compact-separator" aria-hidden="true">•</span>
							<p class="day-muted">Leave by {visit.recommendedLeaveByTime}</p>
						{/if}
					</div>
				</li>
			{/if}
			<li class="day-journey-card rounded-2xl border p-4 text-sm shadow-sm" style={dayThemeStyle(result, visit.dayIndex)}>
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
							{visit.visitType === 'return' ? 'Journey back to hotel' : `Journey to ${visit.placeName}`}
						</p>
						<p class="mt-1 text-base font-semibold text-slate-900">{startName} to {destinationName}</p>
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
						<span title={pillTitle('Distance', segmentDistance(segment, distanceUnit))} class="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
							<AppIcon path={mdiMapMarkerPath} size={14} label="Distance" />
							{segmentDistance(segment, distanceUnit)}
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
					{#each segment.legs as leg, legIndex}
						<div title={pillTitle(legLabel(leg), `${formatDuration(leg.minutes)}${detailDistance(leg, distanceUnit) ? ` • ${detailDistance(leg, distanceUnit)}` : ''}`)} class="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-slate-800 ring-1 ring-slate-200">
							<span class={`inline-flex h-7 w-7 items-center justify-center rounded-full ${leg.mode === 'transit' ? 'bg-slate-100 text-slate-900' : leg.mode === 'wait' ? 'bg-amber-50 text-amber-800' : 'bg-teal-50 text-teal-800'}`}>
								<AppIcon path={iconPathForLeg(leg)} size={16} label={legLabel(leg)} />
							</span>
							<span class="flex flex-col leading-tight">
								<span class="font-medium text-slate-900">{legLabel(leg)}</span>
								<span class="text-xs text-slate-600">
									{formatDuration(leg.minutes)}
									{#if detailDistance(leg, distanceUnit)} • {detailDistance(leg, distanceUnit)}{/if}
									{#if transitStopCountLabel(leg)} • {transitStopCountLabel(leg)}{/if}
								</span>
							</span>
							{#if leg.mode === 'transit' && lineColourKey(leg)}
								<span class={`h-2.5 w-2.5 rounded-full ${lineDotClass(leg)}`}></span>
							{/if}
						</div>
						{#if legIndex < segment.legs.length - 1}
							<span class="text-slate-400" aria-hidden="true">→</span>
						{/if}
					{/each}
				</div>

				<div class="mt-4 rounded-xl border border-slate-200 bg-white p-4">
					<div class="journey-summary-line border-b border-slate-200 pb-4 text-sm text-slate-700">
						<span class="text-slate-900">{startName}</span>
						<span class="compact-separator" aria-hidden="true">•</span>
						<span>Leave {segmentLeaveTime}</span>
						<span class="compact-separator" aria-hidden="true">•</span>
						<span class="text-slate-900">{destinationName}</span>
						<span class="compact-separator" aria-hidden="true">•</span>
						<span>Arrive {visit.arrivalTime}</span>
					</div>
					<p class="mt-3 text-sm font-medium text-slate-900">Journey details</p>
					<ul class="mt-3 space-y-2 text-sm text-slate-700">
						{#each segment.legs as leg, legIndex}
							{@const legStartMinutes = parseTimeToMinutes(segmentLeaveTime) + segment.legs.slice(0, legIndex).reduce((total, currentLeg) => total + currentLeg.minutes, 0)}
							{@const legEndMinutes = legStartMinutes + leg.minutes}
							{@const isFinalLeg = legIndex === segment.legs.length - 1}
							<li class="flex items-start gap-3">
								<span class={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${leg.mode === 'transit' ? lineDotClass(leg) : leg.mode === 'wait' ? 'bg-amber-500' : 'bg-teal-600'}`}></span>
								<div>
									{#if leg.mode === 'transit' && ((legIndex === 0 ? startName : undefined) ?? leg.originName) && ((isFinalLeg ? destinationName : undefined) ?? leg.destinationName)}
										<p>
											Take the <span class={`font-medium ${lineTextClass(leg)}`}>{transitLineName(leg)}</span> line from {(legIndex === 0 ? startName : undefined) ?? leg.originName} to {(isFinalLeg ? destinationName : undefined) ?? leg.destinationName}.
										</p>
									{:else}
										<p>{legDescription(leg, { originOverride: legIndex === 0 ? startName : undefined, destinationOverride: isFinalLeg ? destinationName : undefined })}</p>
									{/if}
									<p class="text-xs text-slate-500">
										Leave {legStartTime(leg, legStartMinutes, useScheduledLegTimes)}
										• Arrive {legEndTime(leg, legEndMinutes, useScheduledLegTimes)}
										• {formatDuration(leg.minutes)}
										{#if detailDistance(leg, distanceUnit)} • {detailDistance(leg, distanceUnit)}{/if}
										{#if transitStopCountLabel(leg)} • {transitStopCountLabel(leg)}{/if}
									</p>
								</div>
							</li>
						{/each}
					</ul>
				</div>
			</li>
		{/if}

		<li class="day-stop-card rounded-xl border p-3" style={dayThemeStyle(result, visit.dayIndex)}>
			{#if visit.visitType === 'return'}
				<p class="font-semibold day-text">{visit.arrivalTime} | Back at {visit.placeName}</p>
				<p class="mt-1 text-sm day-muted">Final return to your hotel or starting point.</p>
			{:else}
				<div class="compact-stop-row">
					<p class="font-semibold day-text">{visit.arrivalTime} - {visit.departureTime}</p>
					<span class="compact-separator" aria-hidden="true">•</span>
					<p class="day-text">{visit.placeName}</p>
					<span class="compact-separator" aria-hidden="true">•</span>
					<p class="day-muted">{plannedStayLabel(formatDuration(visit.dwellMinutes))}</p>
				</div>
			{/if}
		</li>
	{/each}
</ol>

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

	.compact-stop-row,
	.journey-summary-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
		line-height: 1.45;
	}

	.compact-separator {
		color: var(--day-muted);
		padding: 0 0.15rem;
	}
</style>
