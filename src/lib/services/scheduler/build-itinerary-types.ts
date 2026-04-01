import type { Place, RouteSegment } from '$lib/types/planner';

export interface CandidateSelection {
  place: Place;
  index: number;
  segment: RouteSegment;
  rawArrivalMinutes: number;
  fixedArrivalMinutes?: number;
  availabilityEndMinutes: number;
  windowStartMinutes: number;
  windowEndMinutes: number;
  serviceStartMinutes: number;
  requestedDwellMinutes: number;
  scheduledDwellMinutes: number;
  departureMinutes: number;
  returnSegment: RouteSegment;
  projectedDayMinutes: number;
}
