import type { RouteSegment } from '$lib/types/planner';
import type { RouteLookupInput, RoutingProvider } from './provider';

interface ProxyResponse {
  segment: RouteSegment | null;
  error?: string;
}

export const proxyRoutingProvider: RoutingProvider = {
  name: 'routing-proxy',
  async estimateSegment(input: RouteLookupInput): Promise<RouteSegment | null> {
    const response = await fetch('/api/route-segment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      return null;
    }

    const payload: ProxyResponse = await response.json();
    return payload.segment;
  }
};
