import type {
  Coordinates,
  RouteDataSource,
  RouteSegment,
  SegmentLeg,
  SegmentMode,
  TransportMode,
  TransportPreference
} from '$lib/types/planner';

export interface RouteLookupInput {
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  from: Coordinates;
  to: Coordinates;
  mode: TransportMode;
  transportPreferences: TransportPreference[];
  dataSource: RouteDataSource;
  departureMinutes: number;
}

export interface RoutingProvider {
  name: string;
  estimateSegment(input: RouteLookupInput): Promise<RouteSegment | null>;
}

export function buildSegment(
  input: Pick<RouteLookupInput, 'fromId' | 'toId' | 'fromName' | 'toName' | 'from' | 'to'>,
  legs: SegmentLeg[],
  source = 'unknown',
  options: {
    fareGbp?: number | null;
    geometry?: Coordinates[];
  } = {}
): RouteSegment {
  const totalMinutes = legs.reduce((sum, leg) => sum + (Number.isFinite(leg.minutes) ? leg.minutes : 0), 0);
  const distanceKm = legs.reduce((sum, leg) => sum + (Number.isFinite(leg.distanceKm) ? leg.distanceKm : 0), 0);

  return {
    fromId: input.fromId,
    toId: input.toId,
    fromName: input.fromName,
    toName: input.toName,
    fromLocation: input.from,
    toLocation: input.to,
    source,
    totalMinutes,
    distanceKm,
    fareGbp: options.fareGbp,
    geometry: options.geometry,
    legs
  };
}

export function buildSingleLeg(mode: SegmentMode, minutes: number, distanceKm: number, description: string): SegmentLeg {
  return {
    mode,
    minutes: Math.max(1, Math.round(Number.isFinite(minutes) ? minutes : 0)),
    distanceKm: Number((Number.isFinite(distanceKm) ? distanceKm : 0).toFixed(2)),
    description
  };
}

export async function estimateWithProviders(
  input: RouteLookupInput,
  providers: RoutingProvider[]
): Promise<RouteSegment> {
  for (const provider of providers) {
    const candidate = await provider.estimateSegment(input);
    if (candidate) {
      return candidate;
    }
  }

  throw new Error(`No routing provider could resolve ${input.fromName} -> ${input.toName}`);
}
