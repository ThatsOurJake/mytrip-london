import LZString from 'lz-string';
import type { PlannerInput, PlannerResult } from '$lib/types/planner';
import { createPackedEncodedSharedPlannerState, packPlannerInput, packPlannerResult } from './share-pack';
import { buildSharedPlannerState } from './share-state';
import { unpackPlannerInput, unpackPlannerResult } from './share-unpack';
import {
  SHARED_PLANNER_STATE_VERSION,
  type PackedEncodedSharedPlannerState,
  type SharedPlannerState
} from './share-types';

const { compressToEncodedURIComponent, decompressFromEncodedURIComponent } = LZString;

export function createSharedPlannerState(input: PlannerInput, result: PlannerResult): SharedPlannerState {
  return buildSharedPlannerState(
    SHARED_PLANNER_STATE_VERSION,
    unpackPlannerInput(packPlannerInput(input)),
    unpackPlannerResult(packPlannerResult(result))
  );
}

export function encodeSharedPlannerState(input: PlannerInput, result: PlannerResult): string {
  return compressToEncodedURIComponent(JSON.stringify(createPackedEncodedSharedPlannerState(input, result)));
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

    return buildSharedPlannerState(parsed.version, unpackPlannerInput(parsed.input), unpackPlannerResult(parsed.result));
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
