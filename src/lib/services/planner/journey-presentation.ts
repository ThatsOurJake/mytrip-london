import {
  TRANSIT_PREFERENCES,
  type PlannerResult,
  type RouteSegment,
  type SegmentLeg,
  type TransportMode,
  type TransportPreference
} from '$lib/types/planner';

export interface TextRun {
  text: string;
  highlight?: boolean;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function transportPreferenceLabel(preference: TransportPreference): string {
  const labels: Record<TransportPreference, string> = {
    walking: 'Walking',
    cycling: 'Cycling',
    tube: 'Tube',
    bus: 'Bus',
    train: 'Train',
    elizabeth: 'Elizabeth line'
  };

  return labels[preference];
}

export function transportPreferenceSummary(
  mode: TransportMode,
  preferences: TransportPreference[] | undefined
): string {
  if (!preferences?.length) {
    if (mode === 'mixed') {
      return 'Walking + public transport';
    }

    if (mode === 'cycling') {
      return 'Walking + cycling';
    }

    return 'Walking only';
  }

  const selectedTransit = preferences.filter((preference) =>
    TRANSIT_PREFERENCES.includes(preference as (typeof TRANSIT_PREFERENCES)[number])
  );

  if (selectedTransit.length > 0) {
    return ['walking', ...selectedTransit]
      .map((preference) => transportPreferenceLabel(preference as TransportPreference))
      .join(' + ');
  }

  return preferences.map((preference) => transportPreferenceLabel(preference)).join(' + ');
}

export function describeLegTextRuns(leg: SegmentLeg): TextRun[] {
  const highlights = [leg.originName, leg.destinationName].filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  );

  if (highlights.length === 0) {
    return [{ text: leg.description }];
  }

  const runs: TextRun[] = [];
  let cursor = 0;

  for (const highlight of highlights) {
    const index = leg.description.indexOf(highlight, cursor);
    if (index === -1) {
      continue;
    }

    if (index > cursor) {
      runs.push({ text: leg.description.slice(cursor, index) });
    }

    runs.push({ text: highlight, highlight: true });
    cursor = index + highlight.length;
  }

  if (cursor < leg.description.length) {
    runs.push({ text: leg.description.slice(cursor) });
  }

  return runs.length > 0 ? runs : [{ text: leg.description }];
}

export function renderLegTextRunsHtml(leg: SegmentLeg): string {
  return describeLegTextRuns(leg)
    .map((run) => (run.highlight ? `<strong>${escapeHtml(run.text)}</strong>` : escapeHtml(run.text)))
    .join('');
}

export function predictedTflCostGbp(result: PlannerResult): number | null {
  const tflSegments = result.itinerary
    .map((visit) => visit.travelFromPrevious)
    .filter(
      (segment): segment is RouteSegment => segment !== undefined && segment !== null && segment.source === 'tfl'
    );

  if (tflSegments.length === 0) {
    return 0;
  }

  let totalFare = 0;
  let knownFareCount = 0;

  for (const segment of tflSegments) {
    if (segment.fareGbp === null || segment.fareGbp === undefined || !Number.isFinite(segment.fareGbp)) {
      continue;
    }

    totalFare += segment.fareGbp;
    knownFareCount += 1;
  }

  if (knownFareCount === 0) {
    return null;
  }

  return Number(totalFare.toFixed(2));
}

export function predictedTflCostLabel(result: PlannerResult): string {
  const totalFare = predictedTflCostGbp(result);

  if (totalFare === null) {
    return 'TfL fare unavailable';
  }

  const tflSegments = result.itinerary
    .map((visit) => visit.travelFromPrevious)
    .filter(
      (segment): segment is RouteSegment => segment !== undefined && segment !== null && segment.source === 'tfl'
    );
  const completeFareCount = tflSegments.filter(
    (segment) => segment.fareGbp !== null && segment.fareGbp !== undefined && Number.isFinite(segment.fareGbp)
  ).length;

  return completeFareCount < tflSegments.length ? `£${totalFare.toFixed(2)}+` : `£${totalFare.toFixed(2)}`;
}
