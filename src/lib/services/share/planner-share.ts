import LZString from 'lz-string';
import type { PlannerInput } from '$lib/types/planner';
import { normalizePlannerSettings } from '$lib/services/planner/day-settings';
import { normalizePlannerInputPlaces } from '$lib/services/planner/place-constraints';
import { createPackedEncodedSharedPlannerState, packPlannerInput } from './share-pack';
import { unpackPlannerInput } from './share-unpack';
import {
  SHARED_PLANNER_STATE_VERSION,
  type PackedEncodedSharedPlannerState,
  type SharedPlannerState
} from './share-types';

const { compressToEncodedURIComponent, decompressFromEncodedURIComponent } = LZString;

function normalizeSharedInput(input: PlannerInput): PlannerInput {
  return normalizePlannerInputPlaces({
    ...input,
    settings: normalizePlannerSettings(input.settings)
  });
}

export function createSharedPlannerState(input: PlannerInput): SharedPlannerState {
  return {
    version: SHARED_PLANNER_STATE_VERSION,
    input: normalizeSharedInput(unpackPlannerInput(packPlannerInput(input)))
  };
}

export function encodeSharedPlannerState(input: PlannerInput): string {
  return compressToEncodedURIComponent(JSON.stringify(createPackedEncodedSharedPlannerState(input)));
}

export function decodeSharedPlannerState(value: string): SharedPlannerState | null {
  try {
    const decompressed = decompressFromEncodedURIComponent(value);
    if (!decompressed) {
      return null;
    }

    const parsed = JSON.parse(decompressed) as PackedEncodedSharedPlannerState;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== SHARED_PLANNER_STATE_VERSION) {
      return null;
    }

    return {
      version: parsed.version,
      input: normalizeSharedInput(unpackPlannerInput(parsed.input))
    };
  } catch {
    return null;
  }
}

export function buildSharedPlannerPath(input: PlannerInput): string {
  return `/share/${encodeSharedPlannerState(input)}`;
}

export function buildSharedPlannerUrl(origin: string, input: PlannerInput): string {
  return new URL(buildSharedPlannerPath(input), origin).toString();
}
