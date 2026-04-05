import type { PlannerInput } from '$lib/types/planner';
import { paletteIndex } from '$lib/services/planner/day-colors';
import {
  type PackedEncodedSharedPlannerState,
  type PackedPlannerInput,
  SHARED_PLANNER_STATE_VERSION
} from './share-types';

export function packPlannerInput(input: PlannerInput): PackedPlannerInput {
  const compactInput = input;

  return [
    compactInput.hotel.name,
    compactInput.hotel.location.lat,
    compactInput.hotel.location.lng,
    compactInput.places.map((place) => [
      place.id,
      place.name,
      place.location.lat,
      place.location.lng,
      place.constraint.minimumDwellMinutes,
      place.constraint.openingTime,
      place.constraint.closingTime,
      place.constraint.fixedArrival,
      place.constraint.preferredDayId,
      place.constraint.priority
    ]),
    [
      compactInput.settings.tripName,
      compactInput.settings.dayStart,
      compactInput.settings.dayEnd,
      compactInput.settings.mode,
      compactInput.settings.preferences,
      compactInput.settings.dataSource,
      compactInput.settings.startDate,
      compactInput.settings.endDate,
      compactInput.settings.planningDays?.map((day) => [
        day.id,
        day.label,
        day.date,
        day.dayStart,
        day.dayEnd,
        day.fullness,
        paletteIndex(day.palette)
      ])
    ]
  ];
}

export function createPackedEncodedSharedPlannerState(input: PlannerInput): PackedEncodedSharedPlannerState {
  return {
    version: SHARED_PLANNER_STATE_VERSION,
    input: packPlannerInput(input)
  };
}
