import type { PlannerConflict, PlannerWarning, Place } from '$lib/types/planner';

export function createFixedTimeConflict(place: Place, lateByMinutes: number): PlannerConflict {
  return {
    placeId: place.id,
    placeName: place.name,
    type: 'fixed-time',
    message: `Cannot reach ${place.name} by fixed time. You are late by ${lateByMinutes} minutes.`
  };
}

export function createTimeWindowConflict(place: Place, arrivalTime: string): PlannerConflict {
  return {
    placeId: place.id,
    placeName: place.name,
    type: 'time-window',
    message: `Arrival at ${place.name} (${arrivalTime}) is outside the allowed time window.`
  };
}

export function createDwellConflict(
  place: Place,
  requiredReductionMinutes: number,
  allowedMinutes: number
): PlannerConflict {
  return {
    placeId: place.id,
    placeName: place.name,
    type: 'minimum-dwell',
    requiredReductionMinutes,
    message: `${place.name} causes a downstream clash. Reduce dwell by ${requiredReductionMinutes} minutes (to around ${allowedMinutes} minutes).`
  };
}

export function createDayEndConflict(lastPlace: Place, dayEnd: string): PlannerConflict {
  return {
    placeId: lastPlace.id,
    placeName: lastPlace.name,
    type: 'day-end',
    message: `This plan ends after your day end (${dayEnd}).`
  };
}

export function createTightWarning(place: Place, minutesLeft: number): PlannerWarning {
  const label = minutesLeft === 0 ? 'no arrival buffer' : `${minutesLeft} minutes of arrival buffer`;

  return {
    placeId: place.id,
    placeName: place.name,
    type: 'tight-window',
    message: `Tight timing at ${place.name}: ${label} before the latest allowed arrival.`
  };
}
