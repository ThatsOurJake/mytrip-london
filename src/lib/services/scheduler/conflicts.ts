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
    message: `${place.name} cannot be fitted inside its opening hours. The planned start would be ${arrivalTime}.`
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

export function createDayEndWarning(lastPlace: Place, dayEnd: string, overByMinutes: number): PlannerWarning {
  return {
    placeId: lastPlace.id,
    placeName: lastPlace.name,
    type: 'day-end',
    message: `${lastPlace.name} pushes the day past ${dayEnd} by ${overByMinutes} minutes.`
  };
}

export function createExplicitAfterDayEndConflict(place: Place, dayEnd: string, explicitTime: string): PlannerConflict {
  return {
    placeId: place.id,
    placeName: place.name,
    type: 'day-end',
    message: `${place.name} is pinned to ${explicitTime}, which is after your day end (${dayEnd}).`
  };
}

export function createTightWarning(
  place: Place,
  minutesLeft: number,
  reason: 'closing-time' | 'fixed-arrival' = 'closing-time'
): PlannerWarning {
  const message =
    reason === 'fixed-arrival'
      ? minutesLeft === 0
        ? `${place.name} has no buffer before its booked start time. Any delay could make you miss it.`
        : `${place.name} has only ${minutesLeft} minutes of buffer before its booked start time. If there are delays, you could miss the start.`
      : minutesLeft === 0
        ? `Tight timing at ${place.name}: no closing-time buffer.`
        : `Tight timing at ${place.name}: ${minutesLeft} minutes left before closing.`;

  return {
    placeId: place.id,
    placeName: place.name,
    type: 'tight-window',
    message
  };
}

export function createPreferredDayWarning(place: Place, preferredDayLabel: string, actualDayLabel: string): PlannerWarning {
  return {
    placeId: place.id,
    placeName: place.name,
    type: 'preferred-day',
    message: `${place.name} was placed on ${actualDayLabel} instead of the preferred ${preferredDayLabel} to keep the plan workable.`
  };
}

export function createOvernightShiftWarning(place: Place, fromDayLabel: string, toDayLabel: string): PlannerWarning {
  return {
    placeId: place.id,
    placeName: place.name,
    type: 'overnight-shift',
    message: `${place.name} was moved from ${fromDayLabel} to ${toDayLabel} because its fixed time would have been missed earlier in the trip.`
  };
}

export function createShortenedDwellWarning(
  place: Place,
  requestedDwellMinutes: number,
  scheduledDwellMinutes: number,
  closingTime: string
): PlannerWarning {
  return {
    placeId: place.id,
    placeName: place.name,
    type: 'shortened-dwell',
    message: `${place.name} closes at ${closingTime}, so the planned stay was shortened from ${requestedDwellMinutes} minutes to ${scheduledDwellMinutes} minutes.`
  };
}

export function createUnscheduledInfo(place: Place): PlannerWarning {
  return {
    placeId: place.id,
    placeName: place.name,
    type: 'unscheduled',
    message: `${place.name} was left out because higher-priority or time-constrained stops used the available time first.`
  };
}
