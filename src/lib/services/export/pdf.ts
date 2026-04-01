import openStreetMapLogo from '$lib/assets/openstreetmap.svg';
import tflLogo from '$lib/assets/transportforlondon.svg';
import {
	escapeHtml,
	predictedTflCostLabel,
	renderLegTextRunsHtml,
	transportPreferenceSummary
} from '$lib/services/planner/journey-presentation';
import { formatDuration } from '$lib/services/utils';
import type { PlannerInput, PlannerResult } from '$lib/types/planner';

export function exportItineraryPdf(input: PlannerInput, result: PlannerResult): void {
	if (typeof window === 'undefined') {
		return;
	}

	const itineraryRows = result.itinerary
		.map(
			(visit) => {
				const segment = visit.travelFromPrevious;
				const journeyDetails = segment
					? `
					<div class="journey-meta">
						<span>${escapeHtml(formatDuration(segment.totalMinutes))}</span>
						<span>${escapeHtml(segment.source.toUpperCase())}</span>
						${segment.fareGbp ? `<span>£${segment.fareGbp.toFixed(2)}</span>` : ''}
					</div>
					<ul class="leg-list">
						${segment.legs
						.map(
							(leg) => `<li>${renderLegTextRunsHtml(leg)} <span class="muted">(${escapeHtml(formatDuration(leg.minutes))}${leg.distanceKm > 0 ? ` • ${leg.distanceKm.toFixed(2)} km` : ''})</span></li>`
						)
						.join('')}
					</ul>
				`
					: '<p class="muted">No journey segment recorded.</p>';

				const heading =
					visit.visitType === 'return'
						? `${escapeHtml(visit.arrivalTime)} • Return to ${escapeHtml(visit.placeName)}`
						: `${escapeHtml(visit.arrivalTime)} - ${escapeHtml(visit.departureTime)} • ${escapeHtml(visit.placeName)}`;

				const subcopy =
					visit.visitType === 'return'
						? 'Final return to your hotel or starting point.'
						: `Dwell: ${escapeHtml(formatDuration(visit.dwellMinutes))}`;

				return `
				<section class="itinerary-block">
					<p class="muted">${escapeHtml(visit.dayLabel)}${visit.dayDate ? ` • ${escapeHtml(visit.dayDate)}` : ''}</p>
					<h3>${heading}</h3>
					<p class="muted">${subcopy}</p>
					${journeyDetails}
				</section>
			`;
			}
		)
		.join('');

	const conflictRows = result.conflicts
		.map((conflict) => `<li>${escapeHtml(conflict.message)}</li>`)
		.join('');

	const warningRows = result.warnings.map((warning) => `<li>${escapeHtml(warning.message)}</li>`).join('');
	const routeSources = Array.from(new Set(result.itinerary.map((visit) => visit.travelFromPrevious?.source).filter(Boolean)));
	const dataSourceLabel =
		input.settings.dataSource === 'tfl'
			? 'TfL'
			: input.settings.dataSource === 'openstreet'
				? 'OpenStreet'
				: input.settings.dataSource === 'heuristic'
					? 'Heuristic'
					: 'Recommended';

	const printWindow = window.open('', '_blank', 'width=1000,height=800');
	if (!printWindow) {
		throw new Error('Unable to open print window. Please allow pop-ups to export the itinerary.');
	}

	const content = `
		<!doctype html>
		<html lang="en">
			<head>
				<meta charset="utf-8" />
				<title>London Planner Itinerary</title>
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
					.itinerary-block h3 { font-size: 18px; font-weight: 700; }
					.muted { color: #475569; font-size: 13px; margin-top: 6px; }
					.journey-meta { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
					.journey-meta span { border: 1px solid #cbd5e1; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 600; }
					.leg-list { margin: 12px 0 0; padding-left: 18px; }
					.leg-list li { margin-top: 6px; }
					.section { margin-top: 24px; }
					ul { margin: 10px 0 0; padding-left: 18px; }
				</style>
			</head>
			<body>
				<div class="header">
					<div>
						<h1>London Day Planner Itinerary</h1>
						<p class="muted">Hotel: ${escapeHtml(input.hotel.name)} • Trip: ${escapeHtml(input.settings.startDate ?? '')}${input.settings.endDate && input.settings.endDate !== input.settings.startDate ? ` to ${escapeHtml(input.settings.endDate)}` : ''}</p>
					</div>
					<div class="brand-strip">
						${routeSources.includes('tfl') ? `<span class="brand-chip brand-tfl"><img src="${tflLogo}" alt="" />TfL</span>` : ''}
						${routeSources.includes('openrouteservice') ? `<span class="brand-chip brand-osm"><img src="${openStreetMapLogo}" alt="" />OpenStreetMap</span>` : ''}
						${routeSources.includes('heuristic') ? `<span class="brand-chip brand-heuristic">Heuristic</span>` : ''}
					</div>
				</div>

				<div class="summary-grid">
					<div class="card card-primary"><div class="kicker">Travel Time</div><div class="value value-large">${escapeHtml(formatDuration(result.totalTravelMinutes))}</div><div class="note">Total time spent moving between stops.</div></div>
					<div class="card card-primary"><div class="kicker">Dwell Time</div><div class="value value-large">${escapeHtml(formatDuration(result.totalDwellMinutes))}</div><div class="note">Planned time spent at places.</div></div>
					<div class="card card-primary"><div class="kicker">Trip Days</div><div class="value value-large">${result.daysUsed} of ${result.planningDays.length}</div><div class="note">Days currently used by the itinerary.</div></div>
					<div class="card card-primary"><div class="kicker">Predicted Cost</div><div class="value value-large">${escapeHtml(predictedTflCostLabel(result))}</div><div class="note">Summed from available TfL fare data only.</div></div>
				</div>

				<div class="secondary-grid">
					<div class="secondary-cards">
						<div class="card card-secondary"><div class="kicker">Mode</div><div class="value value-secondary">${escapeHtml(transportPreferenceSummary(result.modeUsed, result.preferencesUsed))}</div></div>
						<div class="card card-secondary"><div class="kicker">Data Source</div><div class="value value-secondary">${escapeHtml(dataSourceLabel)}</div></div>
						<div class="card card-secondary"><div class="kicker">Status</div><div class="value value-secondary">${result.feasible ? 'Ready to follow' : 'Needs changes'}</div></div>
					</div>
					${routeSources.length > 0
			? `<div class="card card-secondary route-sources"><div class="kicker">Route Sources</div><div class="route-chip-row">${routeSources
				.map((source) => {
					if (source === 'tfl') {
						return `<span class="route-chip brand-tfl"><img src="${tflLogo}" alt="" />TfL</span>`;
					}

					if (source === 'openrouteservice') {
						return `<span class="route-chip brand-osm"><img src="${openStreetMapLogo}" alt="" />OpenStreet</span>`;
					}

					return `<span class="route-chip brand-heuristic">Heuristic</span>`;
				})
				.join('')}</div></div>`
			: ''}
				</div>

				<div class="notice">
					<strong>Check live travel conditions before you leave.</strong>
					<div class="muted">This itinerary is based on the latest data available to the planner, but you should still confirm timings and disruption details in the TfL app or your maps app on the day.</div>
				</div>

				<div class="section">
					<h2>Itinerary</h2>
					${itineraryRows}
				</div>

				<div class="section">
					<h2>Conflicts</h2>
					${conflictRows ? `<ul>${conflictRows}</ul>` : '<p class="muted">No hard conflicts detected.</p>'}
				</div>

				<div class="section">
					<h2>Warnings</h2>
					${warningRows ? `<ul>${warningRows}</ul>` : '<p class="muted">No warnings recorded.</p>'}
				</div>
			</body>
		</html>
	`;

	printWindow.document.open();
	printWindow.document.write(content);
	printWindow.document.close();
	printWindow.focus();
	printWindow.print();
}
