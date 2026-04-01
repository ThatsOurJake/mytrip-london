import openStreetMapLogo from '$lib/assets/openstreetmap.svg';
import tflLogo from '$lib/assets/transportforlondon.svg';
import {
	escapeHtml,
	predictedTflCostLabel,
	transportPreferenceSummary
} from '$lib/services/planner/journey-presentation';
import {
	legDescription,
	legEndTime,
	lineColourKey,
	planningDayForIndex,
	segmentStartTime,
	segmentUsesScheduledLegTimes,
	transitLineName,
	transitStopCountLabel,
	legStartTime
} from '$lib/components/planner/itinerary';
import {
	SUMMARY_NOTE_COPY,
	TIME_AT_PLACES_LABEL,
	itineraryStatusLabel,
	plannedStayLabel,
	routeDataSourceLabel
} from '$lib/services/planner/ui-text';
import { formatDuration, parseTimeToMinutes } from '$lib/services/utils';
import type { PlannerInput, PlannerResult, RouteSegment, SegmentLeg } from '$lib/types/planner';

const LINE_COLOURS: Record<string, string> = {
	tube: '#0019a8',
	overground: '#fa7b05',
	dlr: '#00afad',
	bus: '#dc241f',
	tram: '#5fb526',
	'national-rail': '#003366',
	bakerloo: '#b26300',
	central: '#dc241f',
	circle: '#ffc80a',
	district: '#007d32',
	'hammersmith-city': '#f589a6',
	jubilee: '#838d93',
	metropolitan: '#9b0058',
	northern: '#000000',
	piccadilly: '#0019a8',
	victoria: '#039be5',
	'waterloo-city': '#76d0bd',
	elizabeth: '#60399e',
	liberty: '#5d6061',
	lioness: '#faa61a',
	mildmay: '#0077ad',
	suffragette: '#5bbd72',
	weaver: '#823a62',
	windrush: '#ed1b00'
};

function routeSourceLabel(source: string): string {
	if (source === 'tfl') {
		return 'TfL';
	}

	if (source === 'openrouteservice') {
		return 'OpenStreet';
	}

	return 'Heuristic';
}

function lineColourHex(leg: SegmentLeg): string {
	const key = lineColourKey(leg);
	return key ? LINE_COLOURS[key] ?? '#0f172a' : '#0f172a';
}

function renderLineName(leg: SegmentLeg): string {
	return `<span class="line-name" style="color:${lineColourHex(leg)}">${escapeHtml(transitLineName(leg))}</span>`;
}

function renderLegDescriptionHtml(
	leg: SegmentLeg,
	options: {
		originOverride?: string;
		destinationOverride?: string;
	} = {}
): string {
	const originName = options.originOverride ?? leg.originName;
	const destinationName = options.destinationOverride ?? leg.destinationName;

	if (leg.mode === 'transit' && originName && destinationName) {
		return `Take the ${renderLineName(leg)} line from ${escapeHtml(originName)} to ${escapeHtml(destinationName)}.`;
	}

	return escapeHtml(legDescription(leg, options));
}

function renderJourneyDetails(
	segment: RouteSegment | undefined,
	options: {
		startName: string;
		destinationName: string;
		leaveTime: string;
		arriveTime: string;
	}
): string {
	if (!segment) {
		return '<p class="muted">No journey segment recorded.</p>';
	}

	const fareLabel = segment.fareGbp ? `<span>£${segment.fareGbp.toFixed(2)}</span>` : '';
	const useScheduledLegTimes = segmentUsesScheduledLegTimes(segment, options.leaveTime, options.arriveTime);
	const legRows = segment.legs
		.map((leg, legIndex) => {
			const legStartMinutes =
				parseTimeToMinutes(options.leaveTime) +
				segment.legs.slice(0, legIndex).reduce((total, currentLeg) => total + currentLeg.minutes, 0);
			const legEndMinutes = legStartMinutes + leg.minutes;
			const isFinalLeg = legIndex === segment.legs.length - 1;
			const originOverride = legIndex === 0 ? options.startName : undefined;
			const destinationOverride = isFinalLeg ? options.destinationName : undefined;
			const stopCount = transitStopCountLabel(leg);

			return `
			<li class="journey-step">
				<span class="step-dot" style="background:${lineColourHex(leg)}"></span>
				<div>
					<p>${renderLegDescriptionHtml(leg, { originOverride, destinationOverride })}</p>
					<p class="muted-muted">
						Leave ${escapeHtml(legStartTime(leg, legStartMinutes, useScheduledLegTimes))}
						• Arrive ${escapeHtml(legEndTime(leg, legEndMinutes, useScheduledLegTimes))}
						• ${escapeHtml(formatDuration(leg.minutes))}
						${leg.distanceKm > 0 ? ` • ${leg.distanceKm.toFixed(2)} km` : ''}
						${stopCount ? ` • ${escapeHtml(stopCount)}` : ''}
					</p>
				</div>
			</li>
		`;
		})
		.join('');

	const compactLegs = segment.legs
		.map((leg) => {
			const stopCount = transitStopCountLabel(leg);
			const lineBadge =
				leg.mode === 'transit'
					? `<span class="line-dot" style="background:${lineColourHex(leg)}"></span>`
					: '';

			return `<span class="leg-pill">${lineBadge}${escapeHtml(
				leg.mode === 'transit' ? transitLineName(leg) : leg.mode === 'wait' ? 'Waiting' : leg.mode === 'walk' ? 'Walk' : 'Cycle'
			)}<span class="pill-meta">${escapeHtml(formatDuration(leg.minutes))}${leg.distanceKm > 0 ? ` • ${leg.distanceKm.toFixed(2)} km` : ''
				}${stopCount ? ` • ${escapeHtml(stopCount)}` : ''}</span></span>`;
		})
		.join('');

	return `
		<div class="journey-meta">
			<span>${escapeHtml(formatDuration(segment.totalMinutes))}</span>
			<span>${escapeHtml(routeSourceLabel(segment.source))}</span>
			${fareLabel}
		</div>
		<div class="leg-pill-row">${compactLegs}</div>
		<div class="journey-detail-box">
			<p class="journey-summary-line">
				<span class="summary-strong">${escapeHtml(options.startName)}</span>
				<span class="summary-separator">•</span>
				<span>Leave ${escapeHtml(options.leaveTime)}</span>
				<span class="summary-separator">•</span>
				<span class="summary-strong">${escapeHtml(options.destinationName)}</span>
				<span class="summary-separator">•</span>
				<span>Arrive ${escapeHtml(options.arriveTime)}</span>
			</p>
			<p class="journey-detail-title">Journey details</p>
			<ul class="leg-list">${legRows}</ul>
		</div>
	`;
}

function renderCompactRow(parts: string[]): string {
	return `<div class="compact-row">${parts.join('<span class="summary-separator">•</span>')}</div>`;
}

function renderItineraryRows(input: PlannerInput, result: PlannerResult): string {
	let markup = '';

	for (const [index, visit] of result.itinerary.entries()) {
		const planningDay = planningDayForIndex(result, visit.dayIndex);
		const previousVisit = result.itinerary[index - 1];

		if (index === 0 || previousVisit?.dayIndex !== visit.dayIndex) {
			markup += `
			<section class="itinerary-block itinerary-day-block">
				${renderCompactRow([
				`<span class="day-kicker">${escapeHtml(visit.dayLabel)}</span>`,
				`<span class="summary-strong">${escapeHtml(planningDay?.date ?? visit.dayDate ?? 'Date not set')}</span>`,
				`${escapeHtml(
					planningDay ? `${planningDay.dayStart} - ${planningDay.dayEnd}` : 'Day window not set'
				)}`
			])}
			</section>
			<section class="itinerary-block itinerary-stop-block">
				${renderCompactRow([
				`<span class="summary-strong">${escapeHtml(planningDay?.dayStart ?? visit.arrivalTime)}</span>`,
				`Start from ${escapeHtml(input.hotel.name)}`,
				visit.recommendedLeaveByTime ? `Leave by ${escapeHtml(visit.recommendedLeaveByTime)}` : 'Start from your hotel or starting point'
			])}
			</section>
		`;
		}

		if (visit.travelFromPrevious) {
			const segment = visit.travelFromPrevious;
			const startName = previousVisit?.dayIndex === visit.dayIndex ? previousVisit.placeName : input.hotel.name;
			const destinationName = visit.visitType === 'return' ? input.hotel.name : visit.placeName;
			const leaveTime = segmentStartTime(
				segment,
				visit.arrivalTime,
				visit.recommendedLeaveByTime,
				previousVisit?.dayIndex === visit.dayIndex ? previousVisit.departureTime : undefined
			);

			if ((visit.freeTimeBeforeVisitMinutes ?? 0) > 0) {
				markup += `
			<section class="itinerary-block itinerary-stop-block itinerary-free-block">
				${renderCompactRow([
					`<span class="summary-strong">Free time before ${escapeHtml(visit.placeName)}</span>`,
					`${escapeHtml(formatDuration(visit.freeTimeBeforeVisitMinutes ?? 0))} free`,
					visit.recommendedLeaveByTime ? `Leave by ${escapeHtml(visit.recommendedLeaveByTime)}` : ''
				].filter(Boolean))}
			</section>
		`;
			}

			markup += `
			<section class="itinerary-block itinerary-journey-block">
				<p class="day-kicker">${escapeHtml(visit.visitType === 'return' ? 'Journey back to hotel' : `Journey to ${visit.placeName}`)}</p>
				<h3>${escapeHtml(startName)} to ${escapeHtml(destinationName)}</h3>
				${renderJourneyDetails(segment as RouteSegment, {
				startName,
				destinationName,
				leaveTime,
				arriveTime: visit.arrivalTime
			})}
			</section>
		`;
		}

		markup +=
			visit.visitType === 'return'
				? `
			<section class="itinerary-block itinerary-stop-block">
				<h3>${escapeHtml(visit.arrivalTime)} | Back at ${escapeHtml(visit.placeName)}</h3>
				<p class="muted">Final return to your hotel or starting point.</p>
			</section>
		`
				: `
			<section class="itinerary-block itinerary-stop-block">
				${renderCompactRow([
					`<span class="summary-strong">${escapeHtml(`${visit.arrivalTime} - ${visit.departureTime}`)}</span>`,
					escapeHtml(visit.placeName),
					escapeHtml(plannedStayLabel(formatDuration(visit.dwellMinutes)))
				])}
			</section>
		`;
	}

	return markup;
}

function renderBrandStrip(routeSources: string[]): string {
	return `
		<div class="brand-strip">
			${routeSources.includes('tfl') ? `<span class="brand-chip brand-tfl"><img src="${tflLogo}" alt="" />TfL</span>` : ''}
			${routeSources.includes('openrouteservice') ? `<span class="brand-chip brand-osm"><img src="${openStreetMapLogo}" alt="" />OpenStreetMap</span>` : ''}
			${routeSources.includes('heuristic') ? '<span class="brand-chip brand-heuristic">Heuristic</span>' : ''}
		</div>
	`;
}

function renderSummarySection(input: PlannerInput, result: PlannerResult, routeSources: string[]): string {
	const dataSourceLabel = routeDataSourceLabel(input.settings.dataSource);
	const routeSourcesCard =
		routeSources.length > 0
			? `<div class="card card-secondary route-sources"><div class="kicker">Route Sources</div><div class="route-chip-row">${routeSources
				.map((source) => {
					if (source === 'tfl') {
						return `<span class="route-chip brand-tfl"><img src="${tflLogo}" alt="" />TfL</span>`;
					}

					if (source === 'openrouteservice') {
						return `<span class="route-chip brand-osm"><img src="${openStreetMapLogo}" alt="" />OpenStreet</span>`;
					}

					return '<span class="route-chip brand-heuristic">Heuristic</span>';
				})
				.join('')}</div></div>`
			: '';

	return `
		<div class="summary-grid">
			<div class="card card-primary"><div class="kicker">Travel Time</div><div class="value value-large">${escapeHtml(formatDuration(result.totalTravelMinutes))}</div><div class="note">${SUMMARY_NOTE_COPY.travelTime}</div></div>
			<div class="card card-primary"><div class="kicker">${TIME_AT_PLACES_LABEL}</div><div class="value value-large">${escapeHtml(formatDuration(result.totalDwellMinutes))}</div><div class="note">${SUMMARY_NOTE_COPY.timeAtPlaces}</div></div>
			<div class="card card-primary"><div class="kicker">Trip Days</div><div class="value value-large">${result.daysUsed} of ${result.planningDays.length}</div><div class="note">${SUMMARY_NOTE_COPY.tripDays}</div></div>
			<div class="card card-primary"><div class="kicker">Predicted Cost</div><div class="value value-large">${escapeHtml(predictedTflCostLabel(result))}</div><div class="note">${SUMMARY_NOTE_COPY.predictedCost}</div></div>
		</div>

		<div class="secondary-grid">
			<div class="secondary-cards">
				<div class="card card-secondary"><div class="kicker">Mode</div><div class="value value-secondary">${escapeHtml(transportPreferenceSummary(result.modeUsed, result.preferencesUsed))}</div></div>
				<div class="card card-secondary"><div class="kicker">Data Source</div><div class="value value-secondary">${escapeHtml(dataSourceLabel)}</div></div>
				<div class="card card-secondary"><div class="kicker">Status</div><div class="value value-secondary">${itineraryStatusLabel(result.feasible)}</div></div>
			</div>
			${routeSourcesCard}
		</div>
	`;
}

function renderListSection(title: string, items: string[], emptyText: string): string {
	return `
		<div class="section">
			<h2>${title}</h2>
			${items.length > 0 ? `<ul>${items.join('')}</ul>` : `<p class="muted">${emptyText}</p>`}
		</div>
	`;
}

function renderStyles(): string {
	return `
		<style>
			body { font-family: "Avenir Next", "Segoe UI", sans-serif; margin: 24px; color: #0f172a; }
			h1, h2, h3, p { margin: 0; }
			.header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
			.brand-strip { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
			.brand-chip { display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; padding: 6px 10px; font-size: 12px; font-weight: 700; }
			.brand-chip img { width: 18px; height: 18px; border-radius: 999px; background: #fff; padding: 2px; }
			.brand-tfl { background: #113b92; color: #fff; }
			.brand-osm { background: #7ebc6f; color: #0f172a; }
			.brand-heuristic { background: #0f172a; color: #fff; }
			.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 18px 0 12px; }
			.card { border: 1px solid #cbd5e1; border-radius: 16px; padding: 10px 12px; background: #f8fafc; }
			.card-primary { background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); }
			.secondary-grid { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; margin: 0 0 18px; align-items: stretch; }
			.secondary-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
			.card-secondary { display: flex; flex-direction: column; justify-content: center; min-height: 72px; padding: 9px 12px; }
			.kicker { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: #475569; font-weight: 700; }
			.value { font-size: 14px; font-weight: 700; margin-top: 4px; line-height: 1.3; }
			.value-large { font-size: 20px; }
			.value-secondary { font-size: 13px; font-weight: 500; line-height: 1.3; }
			.note { margin-top: 4px; font-size: 12px; line-height: 1.4; color: #64748b; }
			.route-sources { min-width: 240px; }
			.route-chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
			.route-chip { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 4px 10px; font-size: 11px; font-weight: 700; }
			.route-chip img { width: 14px; height: 14px; border-radius: 999px; background: #fff; padding: 2px; }
			.notice { border: 1px solid #fde68a; border-radius: 16px; padding: 14px; background: #fffbeb; color: #78350f; margin: 18px 0; }
			.itinerary-block { border: 1px solid #cbd5e1; border-radius: 18px; padding: 16px; background: #ffffff; margin-top: 14px; page-break-inside: avoid; }
			.itinerary-day-block { background: #f8fafc; }
			.itinerary-stop-block { background: #ffffff; }
			.itinerary-free-block { background: #fff7ed; border-color: #fed7aa; }
			.itinerary-journey-block { background: #ffffff; }
			.itinerary-block h3 { font-size: 18px; font-weight: 700; }
			.muted { color: #475569; font-size: 13px; margin-top: 6px; }
			.muted-muted { color: #64748b; font-size: 12px; margin-top: 4px; }
			.day-kicker { font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; color: #64748b; font-weight: 700; margin-bottom: 8px; }
			.compact-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; line-height: 1.45; }
			.summary-strong { font-weight: 700; color: #0f172a; }
			.summary-separator { color: #94a3b8; padding: 0 2px; }
			.journey-meta { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
			.journey-meta span { border: 1px solid #cbd5e1; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 600; }
			.leg-pill-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
			.leg-pill { display: inline-flex; align-items: center; gap: 8px; border: 1px solid #cbd5e1; border-radius: 14px; padding: 8px 10px; font-size: 12px; font-weight: 600; background: #fff; }
			.pill-meta { color: #64748b; font-weight: 500; margin-left: 4px; }
			.line-dot { width: 10px; height: 10px; border-radius: 999px; display: inline-block; }
			.journey-detail-box { margin-top: 14px; border: 1px solid #cbd5e1; border-radius: 14px; padding: 16px; background: #fff; }
			.journey-summary-line { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding-bottom: 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
			.journey-detail-title { margin-top: 14px; font-size: 13px; font-weight: 700; color: #0f172a; }
			.leg-list { list-style: none; margin: 12px 0 0; padding: 0; }
			.journey-step { display: flex; align-items: flex-start; gap: 10px; margin-top: 8px; }
			.step-dot { width: 10px; height: 10px; border-radius: 999px; display: inline-block; margin-top: 5px; flex: 0 0 auto; }
			.line-name { font-weight: 700; }
			.section { margin-top: 24px; }
			ul { margin: 10px 0 0; padding-left: 18px; }
		</style>
	`;
}

export function renderItineraryPdfDocument(input: PlannerInput, result: PlannerResult): string {
	const routeSources = Array.from(
		new Set(result.itinerary.map((visit) => visit.travelFromPrevious?.source).filter((source): source is string => Boolean(source)))
	);
	const itineraryRows = renderItineraryRows(input, result);
	const conflictRows = result.conflicts.map((conflict) => `<li>${escapeHtml(conflict.message)}</li>`);
	const warningRows = result.warnings.map((warning) => `<li>${escapeHtml(warning.message)}</li>`);

	return `
		<!doctype html>
		<html lang="en">
			<head>
				<meta charset="utf-8" />
				<title>London Planner Itinerary</title>
				${renderStyles()}
			</head>
			<body>
				<div class="header">
					<div>
						<h1>London Day Planner Itinerary</h1>
						<p class="muted">Hotel: ${escapeHtml(input.hotel.name)} • Trip: ${escapeHtml(input.settings.startDate ?? '')}${input.settings.endDate && input.settings.endDate !== input.settings.startDate ? ` to ${escapeHtml(input.settings.endDate)}` : ''}</p>
					</div>
					${renderBrandStrip(routeSources)}
				</div>

				${renderSummarySection(input, result, routeSources)}

				<div class="notice">
					<strong>Check live travel conditions before you leave.</strong>
					<div class="muted">This itinerary is based on the latest data available to the planner, but you should still confirm timings and disruption details in the TfL app or your maps app on the day.</div>
				</div>

				<div class="section">
					<h2>Itinerary</h2>
					${itineraryRows}
				</div>

				${renderListSection('Conflicts', conflictRows, 'No hard conflicts detected.')}
				${renderListSection('Warnings', warningRows, 'No warnings recorded.')}
			</body>
		</html>
	`;
}
