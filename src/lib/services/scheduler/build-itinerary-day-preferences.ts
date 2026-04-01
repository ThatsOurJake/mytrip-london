import { parseTimeToMinutes } from '$lib/services/utils';
import type { Place, TripPlanningDay } from '$lib/types/planner';
import type { CandidateSelection } from './build-itinerary-types';

export function hasHardExplicitDayEndConflict(
  place: Place,
  planningDay: TripPlanningDay
): { explicitTime: string } | null {
  const dayEndMinutes = parseTimeToMinutes(planningDay.dayEnd);
  const explicitTime = place.constraint.fixedArrival;
  if (!explicitTime) {
    return null;
  }

  return parseTimeToMinutes(explicitTime) > dayEndMinutes ? { explicitTime } : null;
}

export function preferredDayIndex(place: Place, planningDays: TripPlanningDay[]): number | null {
  if (!place.constraint.preferredDayId) {
    return null;
  }

  const index = planningDays.findIndex((day) => day.id === place.constraint.preferredDayId);
  return index >= 0 ? index : null;
}

export function preferredDayBucket(
  place: Place,
  planningDays: TripPlanningDay[],
  dayIndex: number
): number | null {
  const preferredIndex = preferredDayIndex(place, planningDays);
  if (preferredIndex === null) {
    return 1;
  }

  if (preferredIndex === dayIndex) {
    return 0;
  }

  if (preferredIndex < dayIndex) {
    return 2;
  }

  return null;
}

export function isPinnedToCurrentDay(
  place: Place,
  planningDays: TripPlanningDay[],
  dayIndex: number
): boolean {
  return preferredDayIndex(place, planningDays) === dayIndex;
}

export function shouldDeferFixedStop(
  selection: CandidateSelection,
  dayIndex: number,
  planningDays: TripPlanningDay[]
): boolean {
  if (isPinnedToCurrentDay(selection.place, planningDays, dayIndex)) {
    return false;
  }

  return (
    selection.fixedArrivalMinutes !== undefined &&
    selection.rawArrivalMinutes > selection.fixedArrivalMinutes &&
    dayIndex < planningDays.length - 1
  );
}

export function overflowShouldMoveToLaterDay(
  selection: CandidateSelection,
  dayIndex: number,
  planningDays: TripPlanningDay[],
  dayEndMinutes: number,
  targetDayMinutes: number
): boolean {
  if (isPinnedToCurrentDay(selection.place, planningDays, dayIndex)) {
    return false;
  }

  if (dayIndex >= planningDays.length - 1) {
    return false;
  }

  return selection.departureMinutes > dayEndMinutes || selection.projectedDayMinutes > targetDayMinutes;
}
