import LZString from 'lz-string';
import { normalizePlannerSettings } from '$lib/services/planner/day-settings';
import { normalizePlannerInputPlaces } from '../planner/place-constraints';
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
    planningDays: result.planningDays.map(({ palette: _palette, ...day }) => day as typeof result.planningDays[number]),
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

function compactPlannerInput(input: PlannerInput): PlannerInput {
  return {
    ...input,
    settings: {
      ...input.settings,
      planningDays: input.settings.planningDays?.map(({ palette: _palette, ...day }) => day as NonNullable<PlannerInput['settings']['planningDays']>[number])
    }
  };
}

export function createSharedPlannerState(input: PlannerInput, result: PlannerResult): SharedPlannerState {
  return {
    version: SHARED_PLANNER_STATE_VERSION,
    input: compactPlannerInput(input),
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

    const normalizedInput: PlannerInput = normalizePlannerInputPlaces({
      ...parsed.input,
      settings: normalizePlannerSettings(parsed.input.settings)
    });
    const normalizedDays = normalizedInput.settings.planningDays ?? [];
    const normalizedItinerary = parsed.result.itinerary.map((visit) => {
      const dayIndex = visit.dayIndex ?? 0;
      const planningDay = normalizedDays[dayIndex] ?? normalizedDays[0];

      return {
        ...visit,
        dayIndex,
        dayLabel: visit.dayLabel ?? planningDay?.label ?? 'Day 1',
        dayDate: visit.dayDate ?? planningDay?.date
      };
    });

    return {
      ...parsed,
      input: normalizedInput,
      result: {
        ...parsed.result,
        planningDays: parsed.result.planningDays ?? normalizedDays,
        daysUsed:
          parsed.result.daysUsed ??
          Math.max(0, ...normalizedItinerary.map((visit) => (visit.dayIndex ?? 0) + 1)),
        itinerary: normalizedItinerary
      }
    };
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
