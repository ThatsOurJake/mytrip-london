import { env } from '$env/dynamic/private';
import {
  TRANSIT_PREFERENCES,
  type Coordinates,
  type RouteSegment,
  type SegmentLeg,
  type TransitPreference,
  type TransitLineIdentifier
} from '$lib/types/planner';
import { buildSegment, buildSingleLeg, type RouteLookupInput } from '$lib/services/routing/provider';

interface OrsRouteResponse {
  routes: Array<{
    summary: {
      distance: number;
      duration: number;
    };
    geometry?: string | { coordinates?: number[][] };
  }>;
}

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
      };
      routeOptions?: Array<{
        lineIdentifier?: {
          id?: string;
          name?: string;
          type?: string;
        };
      }>;
    }>;
  }>;
}

type TflJourneyLeg = NonNullable<TflJourneyResponse['journeys']>[number]['legs'][number];

type ProviderName = 'ors' | 'tfl';

function isRoutingDebugEnabled(): boolean {
  const flag = env.ROUTING_DEBUG;
  if (typeof flag === 'string') {
    const normalized = flag.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }

  return process.env.NODE_ENV !== 'production';
}

function logProvider(
  level: 'info' | 'warn',
  provider: ProviderName,
  event: string,
  meta: Record<string, unknown>
): void {
  if (!isRoutingDebugEnabled()) {
    return;
  }

  const logger = level === 'warn' ? console.warn : console.info;
  logger(`[routing:${provider}] ${event}`, meta);
}

function baseMeta(input: RouteLookupInput) {
  return {
    mode: input.mode,
    dataSource: input.dataSource,
    transportPreferences: [...input.transportPreferences].sort(),
    fromId: input.fromId,
    toId: input.toId,
    departureMinutes: input.departureMinutes
  };
}

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

function toOrsProfile(mode: RouteLookupInput['mode']): string | null {
  if (mode === 'walking') {
    return 'foot-walking';
  }
  if (mode === 'cycling') {
    return 'cycling-regular';
  }
  return null;
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

function toCoordinatePair(first: number, second: number): Coordinates | null {
  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    return null;
  }

  const looksLikeLatLng = Math.abs(first) <= 90 && Math.abs(second) <= 180 && Math.abs(first) > 20;
  const looksLikeLngLat = Math.abs(first) <= 180 && Math.abs(second) <= 90 && Math.abs(second) > 20;

  if (looksLikeLatLng) {
    return { lat: first, lng: second };
  }

  if (looksLikeLngLat) {
    return { lat: second, lng: first };
  }

  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
    return { lat: first, lng: second };
  }

  return null;
}

function normalizeGeometryPoints(value: unknown): Coordinates[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (Array.isArray(entry) && entry.length >= 2) {
        return toCoordinatePair(Number(entry[0]), Number(entry[1]));
      }

      if (entry && typeof entry === 'object') {
        const candidate = entry as {
          lat?: number;
          lng?: number;
          lon?: number;
          latitude?: number;
          longitude?: number;
        };

        const lat = candidate.lat ?? candidate.latitude;
        const lng = candidate.lng ?? candidate.lon ?? candidate.longitude;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return { lat: Number(lat), lng: Number(lng) };
        }
      }

      return null;
    })
    .filter((entry): entry is Coordinates => Boolean(entry));
}

function decodePolyline(value: string, precision = 5): Coordinates[] {
  const points: Coordinates[] = [];
  const factor = 10 ** precision;
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < value.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;

    do {
      byte = value.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < value.length);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;

    do {
      byte = value.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < value.length);

    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / factor, lng: lng / factor });
  }

  return points;
}

function parseLineString(value: string | undefined): Coordinates[] {
  if (!value) {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('[')) {
    try {
      return normalizeGeometryPoints(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }

  const coordinates = trimmed
    .split(/\s+/)
    .map((point) => point.split(',').map((entry) => Number(entry.trim())))
    .map((parts) => (parts.length >= 2 ? toCoordinatePair(parts[0] as number, parts[1] as number) : null))
    .filter((entry): entry is Coordinates => Boolean(entry));

  return coordinates;
}

function geometryForOrsRoute(route: OrsRouteResponse['routes'][number], input: RouteLookupInput): Coordinates[] {
  if (typeof route.geometry === 'string') {
    const decoded = decodePolyline(route.geometry);
    if (decoded.length > 1) {
      return decoded;
    }
  }

  const geometryObject = typeof route.geometry === 'object' && route.geometry ? route.geometry : undefined;
  const normalized = normalizeGeometryPoints(geometryObject?.coordinates);
  if (normalized.length > 1) {
    return normalized;
  }

  return [input.from, input.to];
}

function geometryForTflJourney(legs: TflJourneyLeg[], input: RouteLookupInput): Coordinates[] {
  const geometry: Coordinates[] = [];

  for (const leg of legs) {
    const legGeometry = parseLineString(leg.path?.lineString);
    if (legGeometry.length === 0) {
      continue;
    }

    if (geometry.length > 0) {
      const [firstPoint, ...remaining] = legGeometry;
      const previousPoint = geometry[geometry.length - 1];
      if (!firstPoint || previousPoint.lat !== firstPoint.lat || previousPoint.lng !== firstPoint.lng) {
        geometry.push(firstPoint);
      }
      geometry.push(...remaining);
      continue;
    }

    geometry.push(...legGeometry);
  }

  return geometry.length > 1 ? geometry : [input.from, input.to];
}

function mapTflJourneyLegs(legs: TflJourneyLeg[]): SegmentLeg[] {
  return legs.map((leg) => {
    const mappedMode = mapTflMode(leg.mode.name);
    const fromStop = leg.departurePoint?.commonName;
    const toStop = leg.arrivalPoint?.commonName;
    const modeName = toTitleCase(leg.mode.name || mappedMode);
    const lineIdentifier = toLineIdentifier(leg);

    const detail =
      mappedMode === 'transit' && fromStop && toStop
        ? `${modeName} from ${fromStop} to ${toStop}`
        : leg.instruction.summary || modeName;

    return {
      ...buildSingleLeg(mappedMode, leg.duration ?? 0, normalizeTflDistanceKm(leg.distance), detail),
      originName: fromStop,
      destinationName: toStop,
      lineIdentifier
    };
  });
}

export async function estimateOrsSegment(input: RouteLookupInput): Promise<RouteSegment | null> {
  const orsApiKey = env.ORS_API_KEY;

  if (!orsApiKey) {
    logProvider('warn', 'ors', 'skip-missing-api-key', baseMeta(input));
    return null;
  }

  const profile = toOrsProfile(input.mode);

  if (!profile) {
    logProvider('info', 'ors', 'skip-unsupported-mode', baseMeta(input));
    return null;
  }

  logProvider('info', 'ors', 'request-start', {
    ...baseMeta(input),
    profile
  });

  let response: Response;
  try {
    response = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}`, {
      method: 'POST',
      headers: {
        Authorization: orsApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        coordinates: [
          [input.from.lng, input.from.lat],
          [input.to.lng, input.to.lat]
        ]
      })
    });
  } catch (error) {
    logProvider('warn', 'ors', 'request-error', {
      ...baseMeta(input),
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  }

  if (!response.ok) {
    logProvider('warn', 'ors', 'request-non-200', {
      ...baseMeta(input),
      status: response.status,
      statusText: response.statusText
    });
    return null;
  }

  let payload: OrsRouteResponse;
  try {
    payload = (await response.json()) as OrsRouteResponse;
  } catch (error) {
    logProvider('warn', 'ors', 'response-json-parse-failed', {
      ...baseMeta(input),
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  }

  const firstRoute = payload.routes[0];
  if (!firstRoute) {
    logProvider('warn', 'ors', 'response-missing-route', {
      ...baseMeta(input),
      routeCount: payload.routes?.length ?? 0
    });
    return null;
  }

  const minutes = firstRoute.summary.duration / 60;
  const distanceKm = firstRoute.summary.distance / 1000;
  const legMode = input.mode === 'walking' ? 'walk' : 'cycle';

  logProvider('info', 'ors', 'request-success', {
    ...baseMeta(input),
    minutes: Number(minutes.toFixed(1)),
    distanceKm: Number(distanceKm.toFixed(2))
  });

  return buildSegment(input, [buildSingleLeg(legMode, minutes, distanceKm, `Live ${input.mode} route`)], 'openrouteservice', {
    geometry: geometryForOrsRoute(firstRoute, input)
  });
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
