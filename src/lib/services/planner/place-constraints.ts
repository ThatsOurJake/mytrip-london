import type { Place, PlaceConstraint, PlannerInput } from '$lib/types/planner';

type LegacyPlaceConstraint = Omit<PlaceConstraint, 'openingTime' | 'closingTime'> & {
  openingTime?: string;
  closingTime?: string;
  earliestArrival?: string;
  latestArrival?: string;
};

type LegacyPlace = Omit<Place, 'constraint'> & {
  constraint: LegacyPlaceConstraint;
};

export function normalizePlaceConstraint(constraint: LegacyPlaceConstraint): PlaceConstraint {
  return {
    minimumDwellMinutes: constraint.minimumDwellMinutes,
    openingTime: constraint.openingTime ?? constraint.earliestArrival,
    closingTime: constraint.closingTime ?? constraint.latestArrival,
    fixedArrival: constraint.fixedArrival,
    preferredDayId: constraint.preferredDayId,
    priority: constraint.priority
  };
}

export function normalizePlace(place: LegacyPlace): Place {
  return {
    ...place,
    constraint: normalizePlaceConstraint(place.constraint)
  };
}

export function normalizePlannerInputPlaces(input: PlannerInput): PlannerInput {
  return {
    ...input,
    places: input.places.map((place) => normalizePlace(place as LegacyPlace))
  };
}
