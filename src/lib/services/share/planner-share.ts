import LZString from 'lz-string';
import type { PlannerInput, PlannerResult } from '$lib/types/planner';

const { compressToEncodedURIComponent, decompressFromEncodedURIComponent } = LZString;

const SHARED_PLANNER_STATE_VERSION = 1;

export interface SharedPlannerState {
  version: number;
  input: PlannerInput;
  result: PlannerResult;
  createdAt: string;
}

function compactPlannerResult(result: PlannerResult): PlannerResult {
  return {
    ...result,
    itinerary: result.itinerary.map((visit) => ({
      ...visit,
      travelFromPrevious: visit.travelFromPrevious
        ? {
          ...visit.travelFromPrevious,
          geometry: undefined
        }
        : undefined
    }))
  };
}

export function createSharedPlannerState(input: PlannerInput, result: PlannerResult): SharedPlannerState {
  return {
    version: SHARED_PLANNER_STATE_VERSION,
    input,
    result: compactPlannerResult(result),
    createdAt: new Date().toISOString()
  };
}

export function encodeSharedPlannerState(input: PlannerInput, result: PlannerResult): string {
  return compressToEncodedURIComponent(JSON.stringify(createSharedPlannerState(input, result)));
}

export function decodeSharedPlannerState(value: string): SharedPlannerState | null {
  try {
    const decompressed = decompressFromEncodedURIComponent(value);
    if (!decompressed) {
      return null;
    }

    const parsed = JSON.parse(decompressed) as SharedPlannerState;
    if (parsed.version !== SHARED_PLANNER_STATE_VERSION) {
      return null;
    }

    if (!parsed.input || !parsed.result) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function buildSharedPlannerPath(input: PlannerInput, result: PlannerResult): string {
  return `/preview/${encodeSharedPlannerState(input, result)}`;
}

export function buildSharedPlannerUrl(origin: string, input: PlannerInput, result: PlannerResult): string {
  return new URL(buildSharedPlannerPath(input, result), origin).toString();
}
