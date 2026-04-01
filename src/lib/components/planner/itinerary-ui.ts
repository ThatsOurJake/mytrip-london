import {
  mdiBike,
  mdiBusDoubleDecker,
  mdiMapMarkerPath,
  mdiTrain,
  mdiWalk
} from '@mdi/js';
import openStreetMapLogo from '$lib/assets/openstreetmap.svg';
import tflLogo from '$lib/assets/transportforlondon.svg';
import { getDayPalette } from '$lib/services/planner/day-colors';
import { fullnessMultiplier } from '$lib/services/planner/day-settings';
import { DAY_USAGE_FULL_THRESHOLD } from '$lib/services/planner/ui-text';
import { parseTimeToMinutes } from '$lib/services/utils';
import type { PlannerResult, RouteSegment, SegmentLeg } from '$lib/types/planner';

export type DistanceUnit = 'metric' | 'imperial';

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

export function sourceMeta(source: string): {
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

export function sourceList(result: PlannerResult): string[] {
  const sources = new Set<string>();
  for (const visit of result.itinerary) {
    if (visit.travelFromPrevious?.source) {
      sources.add(visit.travelFromPrevious.source);
    }
  }

  return Array.from(sources);
}

export function formatDistance(distanceKm: number | null | undefined, unit: DistanceUnit): string {
  const safeDistanceKm = Number.isFinite(distanceKm) ? Number(distanceKm) : 0;

  if (unit === 'imperial') {
    return `${(safeDistanceKm * KM_TO_MILES).toFixed(2)} mi`;
  }

  return `${safeDistanceKm.toFixed(2)} km`;
}

export function hasDistance(distanceKm: number | null | undefined): boolean {
  return Number.isFinite(distanceKm) && Number(distanceKm) > 0;
}

export function formatFare(fareGbp: number | null | undefined): string | null {
  if (!Number.isFinite(fareGbp) || fareGbp === null || fareGbp === undefined || fareGbp <= 0) {
    return null;
  }

  return `£${fareGbp.toFixed(2)}`;
}

export function iconPathForLeg(leg: SegmentLeg): string {
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

export function legLabel(leg: SegmentLeg): string {
  if (leg.mode === 'walk') {
    return 'Walk';
  }

  if (leg.mode === 'cycle') {
    return 'Cycle';
  }

  return leg.lineIdentifier?.name || leg.lineIdentifier?.id || 'Transit';
}

export function lineColourKey(leg: SegmentLeg): string | null {
  const aliases: Record<string, string> = {
    'elizabeth-line': 'elizabeth',
    'london-overground': 'overground',
    'public-bus': 'bus',
    train: 'national-rail'
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

export function lineDotClass(leg: SegmentLeg): string {
  const key = lineColourKey(leg);
  return key ? `bg-${key}` : 'bg-slate-400';
}

export function detailDistance(leg: SegmentLeg, unit: DistanceUnit): string | null {
  if (!hasDistance(leg.distanceKm)) {
    return null;
  }

  return formatDistance(leg.distanceKm, unit);
}

export function segmentDistance(segment: RouteSegment, unit: DistanceUnit): string {
  if (!hasDistance(segment.distanceKm)) {
    return 'Distance unavailable';
  }

  return formatDistance(segment.distanceKm, unit);
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

export function googleMapsHref(segment: RouteSegment): string {
  const query = new URLSearchParams({
    api: '1',
    origin: `${segment.fromLocation.lat},${segment.fromLocation.lng}`,
    destination: `${segment.toLocation.lat},${segment.toLocation.lng}`,
    travelmode: googleMapsTravelMode(segment)
  });

  return `https://www.google.com/maps/dir/?${query.toString()}`;
}

export function pillTitle(label: string, detail?: string): string {
  return detail ? `${label}: ${detail}` : label;
}

function dayUsageStatus(usedMinutes: number, targetMinutes: number): 'light' | 'full' | 'over capacity' {
  if (usedMinutes > targetMinutes) {
    return 'over capacity';
  }

  if (usedMinutes >= targetMinutes * DAY_USAGE_FULL_THRESHOLD) {
    return 'full';
  }

  return 'light';
}

export function dayUsageClasses(status: 'light' | 'full' | 'over capacity'): string {
  switch (status) {
    case 'over capacity':
      return 'border-rose-200 bg-rose-50 text-rose-900';
    case 'full':
      return 'border-amber-200 bg-amber-50 text-amber-950';
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  }
}

export function buildDaySummaries(result: PlannerResult) {
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

export function planningDayForIndex(result: PlannerResult, dayIndex: number) {
  return result.planningDays[dayIndex] ?? result.planningDays[0];
}

export function dayThemeStyle(result: PlannerResult, dayIndex: number, emphasis: 'soft' | 'strong' = 'soft'): string {
  const planningDay = planningDayForIndex(result, dayIndex);
  const palette = getDayPalette(planningDay?.palette);
  return `--day-bg:${emphasis === 'strong' ? palette.surfaceStrong : palette.surface};--day-border:${palette.border};--day-text:${palette.text};--day-muted:${palette.muted};`;
}

export function dayWindowLabel(result: PlannerResult, dayIndex: number): string {
  const planningDay = planningDayForIndex(result, dayIndex);
  return planningDay ? `${planningDay.dayStart} to ${planningDay.dayEnd}` : '';
}
