import { env } from '$env/dynamic/private';
import { buildSegment, buildSingleLeg, type RouteLookupInput } from '$lib/services/routing/provider';
import type { RouteSegment } from '$lib/types/planner';
import { geometryForOrsRoute } from '../shared/provider-geometry';
import { baseMeta, logProvider } from '../shared/provider-logging';

interface OrsRouteResponse {
  routes: Array<{
    summary: {
      distance: number;
      duration: number;
    };
    geometry?: string | { coordinates?: number[][] };
  }>;
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

  return buildSegment(
    input,
    [buildSingleLeg(legMode, minutes, distanceKm, `Live ${input.mode} route`)],
    'openrouteservice',
    {
      geometry: geometryForOrsRoute(firstRoute, input)
    }
  );
}
