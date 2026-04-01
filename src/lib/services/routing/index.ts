import type { PlannerInput, RouteNode, RouteSegment } from '$lib/types/planner';
import { estimateWithProviders, type RouteLookupInput } from './provider';
import { heuristicRoutingProvider } from './heuristic';
import { proxyRoutingProvider } from './proxy';

export function buildNodes(input: PlannerInput): RouteNode[] {
  return [
    {
      id: 'hotel',
      name: input.hotel.name,
      location: input.hotel.location
    },
    ...input.places.map((place) => ({
      id: place.id,
      name: place.name,
      location: place.location,
      constraint: place.constraint
    }))
  ];
}

function cacheKey(input: RouteLookupInput): string {
  return [input.fromId, input.toId, input.mode, input.dataSource, [...input.transportPreferences].sort().join(',')].join(':');
}

export class RoutingEngine {
  private cache = new Map<string, RouteSegment>();

  async getSegment(input: RouteLookupInput): Promise<RouteSegment> {
    const key = cacheKey(input);
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const segment = await estimateWithProviders(input, [
      proxyRoutingProvider,
      heuristicRoutingProvider
    ]);
    this.cache.set(key, segment);
    return segment;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
