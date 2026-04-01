import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RouteLookupInput } from '$lib/services/routing/provider';
import type { RouteSegment } from '$lib/types/planner';
import { estimateOrsSegment, estimateTflSegment } from '$lib/server/routing/external-providers';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 120;
const DEFAULT_ROUTE_CACHE_TTL_MS = 30 * 60 * 1000;

const requestWindow = new Map<string, { count: number; startedAt: number }>();
const routeSegmentCache = new Map<string, { expiresAt: number; segment: RouteSegment | null }>();

function isRoutingDebugEnabled(): boolean {
  const flag = env.ROUTING_DEBUG;
  if (typeof flag === 'string') {
    const normalized = flag.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }

  return process.env.NODE_ENV !== 'production';
}

function logRouteCache(event: string, meta: Record<string, unknown>): void {
  if (!isRoutingDebugEnabled()) {
    return;
  }

  console.info(`[routing:cache] ${event}`, meta);
}

function getRouteCacheTtlMs(): number {
  const configured = Number(env.ROUTE_SEGMENT_CACHE_TTL_MS);
  if (Number.isFinite(configured) && configured >= 0) {
    return configured;
  }

  return DEFAULT_ROUTE_CACHE_TTL_MS;
}

function cacheKey(input: RouteLookupInput): string {
  return JSON.stringify({
    fromId: input.fromId,
    toId: input.toId,
    mode: input.mode,
    dataSource: input.dataSource,
    transportPreferences: [...input.transportPreferences].sort(),
    departureMinutes: input.departureMinutes,
    from: input.from,
    to: input.to
  });
}

function cacheMeta(input: RouteLookupInput): Record<string, unknown> {
  return {
    fromId: input.fromId,
    toId: input.toId,
    mode: input.mode,
    dataSource: input.dataSource,
    transportPreferences: [...input.transportPreferences].sort(),
    departureMinutes: input.departureMinutes
  };
}

function readCachedSegment(input: RouteLookupInput): RouteSegment | null | undefined {
  const key = cacheKey(input);
  const cached = routeSegmentCache.get(key);
  if (!cached) {
    return undefined;
  }

  if (cached.expiresAt <= Date.now()) {
    routeSegmentCache.delete(key);
    logRouteCache('expired', cacheMeta(input));
    return undefined;
  }

  return cached.segment;
}

function writeCachedSegment(input: RouteLookupInput, segment: RouteSegment | null): void {
  const ttlMs = getRouteCacheTtlMs();
  routeSegmentCache.set(cacheKey(input), {
    expiresAt: Date.now() + ttlMs,
    segment
  });

  logRouteCache('write', {
    ...cacheMeta(input),
    ttlMs,
    hasSegment: Boolean(segment)
  });
}

function getClientKey(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  return request.headers.get('cf-connecting-ip') || 'local';
}

function isRateLimited(clientKey: string): boolean {
  const now = Date.now();
  const current = requestWindow.get(clientKey);

  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    requestWindow.set(clientKey, { count: 1, startedAt: now });
    return false;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  current.count += 1;
  requestWindow.set(clientKey, current);
  return false;
}

function allowOrigin(requestUrl: URL, request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.host === requestUrl.host;
  } catch {
    return false;
  }
}

async function resolveRouteSegment(input: RouteLookupInput) {
  const preferredProviders =
    input.dataSource === 'tfl'
      ? [estimateTflSegment]
      : input.dataSource === 'openstreet'
        ? [estimateOrsSegment]
        : input.dataSource === 'heuristic'
          ? []
          : input.mode === 'mixed'
            ? [estimateTflSegment, estimateOrsSegment]
            : [estimateOrsSegment, estimateTflSegment];

  for (const provider of preferredProviders) {
    const segment = await provider(input);
    if (segment) {
      return segment;
    }
  }

  return null;
}

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
};

export const POST: RequestHandler = async ({ request, url }) => {
  if (!allowOrigin(url, request)) {
    return json({ error: 'Origin is not allowed.' }, { status: 403 });
  }

  const clientKey = getClientKey(request);
  if (isRateLimited(clientKey)) {
    return json({ error: 'Rate limit exceeded. Please retry shortly.' }, { status: 429 });
  }

  const payload = (await request.json()) as RouteLookupInput;

  const cached = readCachedSegment(payload);
  if (cached !== undefined) {
    logRouteCache('hit', {
      ...cacheMeta(payload),
      hasSegment: Boolean(cached)
    });
    return json({ segment: cached, cached: true });
  }

  logRouteCache('miss', cacheMeta(payload));

  const segment = await resolveRouteSegment(payload);
  writeCachedSegment(payload, segment);

  if (!segment) {
    return json({ segment: null, cached: false });
  }

  return json({ segment, cached: false });
};
