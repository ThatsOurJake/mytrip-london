import { TRANSIT_PREFERENCES, type SegmentLeg, type TransportMode, type TransportPreference } from '$lib/types/planner';

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
