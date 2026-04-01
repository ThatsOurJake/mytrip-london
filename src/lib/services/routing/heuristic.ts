import type { RouteSegment, TransportMode } from '$lib/types/planner';
import { distanceKm } from '$lib/services/utils';
import { buildSegment, buildSingleLeg, type RouteLookupInput, type RoutingProvider } from './provider';
import {
  DEFAULT_TRANSIT_SPEED_KMH,
  DEFAULT_TRANSIT_WAIT_MINUTES,
  MAX_WALK_TO_TRANSIT_DISTANCE_KM,
  MIN_TRANSIT_LEG_MINUTES,
  TRANSIT_ACCESS_DISTANCE_RATIO
} from './constants';

const MODE_SPEED_KMH: Record<Exclude<TransportMode, 'mixed'>, number> = {
  walking: 4.8,
  cycling: 14
};

function estimateModeMinutes(distance: number, mode: Exclude<TransportMode, 'mixed'>): number {
  return (distance / MODE_SPEED_KMH[mode]) * 60;
}

export const heuristicRoutingProvider: RoutingProvider = {
  name: 'heuristic',
  async estimateSegment(input: RouteLookupInput): Promise<RouteSegment> {
    const distance = distanceKm(input.from, input.to);

    if (input.mode === 'mixed') {
      const walkToTransitDistance = Math.min(MAX_WALK_TO_TRANSIT_DISTANCE_KM, distance * TRANSIT_ACCESS_DISTANCE_RATIO);
      const walkFromTransitDistance = Math.min(MAX_WALK_TO_TRANSIT_DISTANCE_KM, distance * TRANSIT_ACCESS_DISTANCE_RATIO);
      const transitDistance = Math.max(0, distance - walkToTransitDistance - walkFromTransitDistance);

      const walkInMinutes = estimateModeMinutes(walkToTransitDistance, 'walking');
      const walkOutMinutes = estimateModeMinutes(walkFromTransitDistance, 'walking');
      const transitMinutes = Math.max(MIN_TRANSIT_LEG_MINUTES, (transitDistance / DEFAULT_TRANSIT_SPEED_KMH) * 60);
      const waitingMinutes = DEFAULT_TRANSIT_WAIT_MINUTES;

      return buildSegment(input, [
        buildSingleLeg('walk', walkInMinutes, walkToTransitDistance, 'Walk to nearest station'),
        buildSingleLeg('wait', waitingMinutes, 0, 'Wait for the next public transport connection'),
        buildSingleLeg('transit', transitMinutes, transitDistance, 'Ride public transport'),
        buildSingleLeg('walk', walkOutMinutes, walkFromTransitDistance, 'Walk to destination')
      ], 'heuristic', {
        geometry: [input.from, input.to]
      });
    }

    const minutes = estimateModeMinutes(distance, input.mode);
    const modeLabel = input.mode === 'walking' ? 'Walking route' : 'Cycling route';
    const segmentMode = input.mode === 'walking' ? 'walk' : 'cycle';

    return buildSegment(input, [buildSingleLeg(segmentMode, minutes, distance, modeLabel)], 'heuristic', {
      geometry: [input.from, input.to]
    });
  }
};
