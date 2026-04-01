import { env } from '$env/dynamic/private';
import { buildSegment, buildSingleLeg, type RouteLookupInput } from '$lib/services/routing/provider';
import {
  TRANSIT_PREFERENCES,
  type RouteSegment,
  type SegmentLeg,
  type TransitPreference,
  type TransitLineIdentifier
} from '$lib/types/planner';
import { geometryForTflJourney } from '../shared/provider-geometry';
import { baseMeta, logProvider } from '../shared/provider-logging';

interface TflJourneyResponse {
  journeys?: Array<{
    fare?: {
      totalCost?: number;
    };
    legs: Array<{
      mode: {
        id?: string;
        name: string;
        type?: string;
      };
      duration?: number;
      distance?: number | null;
      instruction: {
        summary?: string;
      };
      departurePoint?: {
        commonName?: string;
      };
      arrivalPoint?: {
        commonName?: string;
      };
      path?: {
        lineString?: string;
        stopPoints?: Array<{
          name?: string;
        }>;
      };
      routeOptions?: Array<{
        lineIdentifier?: {
          id?: string;
          name?: string;
          type?: string;
        };
      }>;
      scheduledDepartureTime?: string;
      scheduledArrivalTime?: string;
      interChangeDuration?: string;
      interChangePosition?: string;
    }>;
  }>;
}

type TflJourneyLeg = NonNullable<TflJourneyResponse['journeys']>[number]['legs'][number];

function selectedTransitPreferences(input: RouteLookupInput): TransitPreference[] {
  const selected = input.transportPreferences.filter((preference): preference is TransitPreference =>
    TRANSIT_PREFERENCES.includes(preference as TransitPreference)
  );

  return selected.length > 0 ? selected : [...TRANSIT_PREFERENCES];
}

function toTflModes(input: RouteLookupInput): string[] {
  const mapped = new Set<string>(['walking']);
  const modeMap: Record<TransitPreference, string[]> = {
    tube: ['tube', 'overground', 'dlr'],
    bus: ['bus'],
    train: ['national-rail', 'tram'],
    elizabeth: ['elizabeth-line']
  };

  for (const preference of selectedTransitPreferences(input)) {
    for (const mode of modeMap[preference]) {
      mapped.add(mode);
    }
  }

  return Array.from(mapped);
}

function toTflClock(minutes: number): string {
  const normalized = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
  const mins = String(normalized % 60).padStart(2, '0');
  return `${hours}${mins}`;
}

function toTflDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function mapTflMode(modeName: string): SegmentLeg['mode'] {
  const normalized = modeName.toLowerCase();
  if (normalized.includes('walk')) {
    return 'walk';
  }
  if (normalized.includes('cycle')) {
    return 'cycle';
  }
  return 'transit';
}

function toTitleCase(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toLineIdentifier(leg: TflJourneyLeg): TransitLineIdentifier | undefined {
  const lineIdentifier = leg.routeOptions?.[0]?.lineIdentifier;

  if (lineIdentifier?.id || lineIdentifier?.name || lineIdentifier?.type) {
    return {
      id: lineIdentifier.id,
      name: lineIdentifier.name,
      type: lineIdentifier.type
    };
  }

  if (leg.mode.id || leg.mode.name || leg.mode.type) {
    return {
      id: leg.mode.id,
      name: leg.mode.name,
      type: leg.mode.type
    };
  }

  return undefined;
}

function normalizeTflDistanceKm(distanceMeters: number | null | undefined): number {
  if (!Number.isFinite(distanceMeters)) {
    return 0;
  }

  return (distanceMeters as number) / 1000;
}

function normalizeTflFareGbp(totalCost: number | undefined): number | null {
  if (!Number.isFinite(totalCost)) {
    return null;
  }

  return Number(((totalCost as number) / 100).toFixed(2));
}

function mapTflJourneyLegs(legs: TflJourneyLeg[]): SegmentLeg[] {
  const mappedLegs: SegmentLeg[] = [];

  legs.forEach((leg, index) => {
    const mappedMode = mapTflMode(leg.mode.name);
    const fromStop = leg.departurePoint?.commonName;
    const toStop = leg.arrivalPoint?.commonName;
    const modeName = toTitleCase(leg.mode.name || mappedMode);
    const lineIdentifier = toLineIdentifier(leg);

    const detail =
      mappedMode === 'transit' && fromStop && toStop
        ? `${modeName} from ${fromStop} to ${toStop}`
        : leg.instruction.summary || modeName;

    mappedLegs.push({
      ...buildSingleLeg(mappedMode, leg.duration ?? 0, normalizeTflDistanceKm(leg.distance), detail),
      originName: fromStop,
      destinationName: toStop,
      lineIdentifier,
      scheduledDepartureTime: leg.scheduledDepartureTime,
      scheduledArrivalTime: leg.scheduledArrivalTime,
      intermediateStopNames: leg.path?.stopPoints
        ?.map((stopPoint) => stopPoint.name?.trim())
        .filter((name): name is string => Boolean(name))
    });

    const interchangeMinutes = Number.parseInt(leg.interChangeDuration ?? '', 10);
    if (Number.isFinite(interchangeMinutes) && interchangeMinutes > 0 && index < legs.length - 1) {
      mappedLegs.push({
        ...buildSingleLeg('wait', interchangeMinutes, 0, 'Change here and wait for the next service'),
        originName: toStop,
        destinationName: toStop
      });
    }
  });

  return mappedLegs;
}

export async function estimateTflSegment(input: RouteLookupInput): Promise<RouteSegment | null> {
  const tflAppKey = env.TFL_APP_KEY;
  if (input.mode !== 'mixed') {
    logProvider('info', 'tfl', 'skip-non-mixed-mode', baseMeta(input));
    return null;
  }

  if (!tflAppKey) {
    logProvider('warn', 'tfl', 'skip-missing-api-key', baseMeta(input));
    return null;
  }

  const from = `${input.from.lat},${input.from.lng}`;
  const to = `${input.to.lat},${input.to.lng}`;
  const tflModes = toTflModes(input);
  const query = new URLSearchParams({
    app_key: tflAppKey,
    mode: tflModes.join(','),
    timeIs: 'Departing',
    journeyPreference: 'LeastTime',
    time: toTflClock(input.departureMinutes),
    date: toTflDate()
  });

  const endpoint = `https://api.tfl.gov.uk/Journey/JourneyResults/${encodeURIComponent(from)}/to/${encodeURIComponent(to)}?${query.toString()}`;

  logProvider('info', 'tfl', 'request-start', {
    ...baseMeta(input),
    queryModes: tflModes,
    date: query.get('date'),
    time: query.get('time')
  });

  let response: Response;
  try {
    response = await fetch(endpoint);
  } catch (error) {
    logProvider('warn', 'tfl', 'request-error', {
      ...baseMeta(input),
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  }

  if (!response.ok) {
    logProvider('warn', 'tfl', 'request-non-200', {
      ...baseMeta(input),
      status: response.status,
      statusText: response.statusText
    });
    return null;
  }

  let payload: TflJourneyResponse;

  try {
    payload = (await response.json()) as TflJourneyResponse;
  } catch (error) {
    logProvider('warn', 'tfl', 'response-json-parse-failed', {
      ...baseMeta(input),
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  }

  const journey = payload.journeys?.[0];

  if (!journey || journey.legs.length === 0) {
    logProvider('warn', 'tfl', 'response-missing-journey', {
      ...baseMeta(input),
      journeyCount: payload.journeys?.length ?? 0
    });
    return null;
  }

  logProvider('info', 'tfl', 'request-success', {
    ...baseMeta(input),
    journeyCount: payload.journeys?.length ?? 0,
    legCount: journey.legs.length,
    fareGbp: normalizeTflFareGbp(journey.fare?.totalCost)
  });

  return buildSegment(input, mapTflJourneyLegs(journey.legs), 'tfl', {
    fareGbp: normalizeTflFareGbp(journey.fare?.totalCost),
    geometry: geometryForTflJourney(journey.legs, input)
  });
}
