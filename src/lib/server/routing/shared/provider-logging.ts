import { env } from '$env/dynamic/private';
import type { RouteLookupInput } from '$lib/services/routing/provider';

export type ProviderName = 'ors' | 'tfl';

function isRoutingDebugEnabled(): boolean {
  const flag = env.ROUTING_DEBUG;
  if (typeof flag === 'string') {
    const normalized = flag.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }

  return process.env.NODE_ENV !== 'production';
}

export function logProvider(
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

export function baseMeta(input: RouteLookupInput) {
  return {
    mode: input.mode,
    dataSource: input.dataSource,
    transportPreferences: [...input.transportPreferences].sort(),
    fromId: input.fromId,
    toId: input.toId,
    departureMinutes: input.departureMinutes
  };
}
