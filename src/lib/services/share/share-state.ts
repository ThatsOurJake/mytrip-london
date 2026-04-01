import { normalizePlannerSettings } from '$lib/services/planner/day-settings';
import { normalizePlannerInputPlaces } from '../planner/place-constraints';
import type {
  Coordinates,
  PlannerInput,
  PlannerResult,
  RouteSegment
} from '$lib/types/planner';
import type {
  CompactSharedConflict,
  CompactSharedPlannerResult,
  CompactSharedRouteSegment,
  CompactSharedVisit,
  CompactSharedWarning,
  SharedPlannerState
} from './share-types';

function placeLookup(input: PlannerInput): Map<string, PlannerInput['places'][number]> {
  return new Map(input.places.map((place) => [place.id, place]));
}

function destinationNodeForVisit(
  visit: Pick<CompactSharedVisit, 'placeId' | 'visitType'>,
  input: PlannerInput,
  placesById: Map<string, PlannerInput['places'][number]>
): { id: string; name: string; location: Coordinates } {
  if (visit.visitType === 'return') {
    return {
      id: 'hotel',
      name: input.hotel.name,
      location: input.hotel.location
    };
  }

  const place = placesById.get(visit.placeId);
  return {
    id: visit.placeId,
    name: place?.name ?? visit.placeId,
    location: place?.location ?? input.hotel.location
  };
}

function expandRouteSegment(
  segment: CompactSharedRouteSegment,
  visit: CompactSharedVisit,
  visitIndex: number,
  itinerary: CompactSharedVisit[],
  input: PlannerInput,
  placesById: Map<string, PlannerInput['places'][number]>
): RouteSegment {
  const previousVisit = itinerary[visitIndex - 1];
  const startsFromHotel = !previousVisit || previousVisit.dayIndex !== visit.dayIndex;
  const fromNode = startsFromHotel
    ? { id: 'hotel', name: input.hotel.name, location: input.hotel.location }
    : destinationNodeForVisit(previousVisit, input, placesById);
  const toNode = destinationNodeForVisit(visit, input, placesById);

  return {
    fromId: fromNode.id,
    toId: toNode.id,
    fromName: fromNode.name,
    toName: toNode.name,
    fromLocation: fromNode.location,
    toLocation: toNode.location,
    source: segment.source,
    totalMinutes: segment.totalMinutes,
    distanceKm: segment.distanceKm,
    fareGbp: segment.fareGbp,
    geometry: undefined,
    legs: segment.legs
  };
}

function orderedPlacesFromItinerary(
  input: PlannerInput,
  itinerary: Array<Pick<CompactSharedVisit, 'visitType' | 'placeId'>>
): PlannerInput['places'] {
  const seen = new Set<string>();
  const scheduledPlaces = itinerary
    .filter((visit) => visit.visitType === 'place')
    .map((visit) => visit.placeId)
    .flatMap((placeId) => {
      if (seen.has(placeId)) {
        return [];
      }

      seen.add(placeId);
      const place = input.places.find((entry) => entry.id === placeId);
      return place ? [place] : [];
    });

  const remainingPlaces = input.places.filter((place) => !seen.has(place.id));
  return [...scheduledPlaces, ...remainingPlaces];
}

function totalTravelMinutesFromItinerary(
  itinerary: Array<{ travelFromPrevious?: Pick<CompactSharedRouteSegment, 'totalMinutes'> }>
): number {
  return itinerary.reduce((total, visit) => total + (visit.travelFromPrevious?.totalMinutes ?? 0), 0);
}

function totalDwellMinutesFromItinerary(itinerary: Array<Pick<CompactSharedVisit, 'dwellMinutes'>>): number {
  return itinerary.reduce((total, visit) => total + visit.dwellMinutes, 0);
}

function daysUsedFromItinerary(itinerary: Array<Pick<CompactSharedVisit, 'dayIndex'>>): number {
  return itinerary.length === 0 ? 0 : Math.max(0, ...itinerary.map((visit) => (visit.dayIndex ?? 0) + 1));
}

function placeNameForVisit(
  visit: Pick<CompactSharedVisit, 'placeId' | 'visitType' | 'placeName'>,
  input: PlannerInput,
  placesById: Map<string, PlannerInput['places'][number]>
): string {
  if (visit.visitType === 'return') {
    return input.hotel.name;
  }

  return placesById.get(visit.placeId)?.name ?? visit.placeName ?? visit.placeId;
}

function placeNameForAlert(
  alert: Pick<CompactSharedConflict | CompactSharedWarning, 'placeId' | 'placeName'>,
  input: PlannerInput,
  placesById: Map<string, PlannerInput['places'][number]>
): string {
  return placesById.get(alert.placeId)?.name ?? alert.placeName ?? alert.placeId;
}

export function buildSharedPlannerState(
  version: number,
  input: PlannerInput,
  compactResult: CompactSharedPlannerResult
): SharedPlannerState {
  const normalizedInput: PlannerInput = normalizePlannerInputPlaces({
    ...input,
    settings: normalizePlannerSettings(input.settings)
  });
  const normalizedDays = normalizedInput.settings.planningDays ?? [];
  const placesById = placeLookup(normalizedInput);
  const normalizedItinerary: CompactSharedVisit[] = compactResult.itinerary.map((visit) => {
    const dayIndex = visit.dayIndex ?? 0;
    const planningDay = normalizedDays[dayIndex] ?? normalizedDays[0];

    return {
      ...visit,
      dayIndex,
      dayLabel: planningDay?.label ?? visit.dayLabel ?? 'Day 1',
      dayDate: planningDay?.date ?? visit.dayDate
    };
  });

  return {
    version,
    input: normalizedInput,
    result: {
      orderedPlaces: orderedPlacesFromItinerary(normalizedInput, normalizedItinerary),
      modeUsed: normalizedInput.settings.mode,
      preferencesUsed: normalizedInput.settings.preferences ?? ['walking'],
      planningDays: normalizedDays,
      daysUsed: daysUsedFromItinerary(normalizedItinerary),
      itinerary: normalizedItinerary.map((visit, index, itinerary) => ({
        placeId: visit.placeId,
        placeName: placeNameForVisit(visit, normalizedInput, placesById),
        visitType: visit.visitType,
        dayIndex: visit.dayIndex,
        dayLabel: visit.dayLabel ?? 'Day 1',
        dayDate: visit.dayDate,
        arrivalTime: visit.arrivalTime,
        departureTime: visit.departureTime,
        dwellMinutes: visit.dwellMinutes,
        windowStatus: visit.windowStatus,
        travelFromPrevious: visit.travelFromPrevious
          ? expandRouteSegment(visit.travelFromPrevious, visit, index, itinerary, normalizedInput, placesById)
          : undefined,
        recommendedLeaveByTime: visit.recommendedLeaveByTime,
        freeTimeBeforeVisitMinutes: visit.freeTimeBeforeVisitMinutes
      })),
      conflicts: compactResult.conflicts.map((conflict) => ({
        placeId: conflict.placeId,
        placeName: placeNameForAlert(conflict, normalizedInput, placesById),
        type: conflict.type,
        message: conflict.message,
        requiredReductionMinutes: conflict.requiredReductionMinutes
      })),
      warnings: compactResult.warnings.map((warning) => ({
        placeId: warning.placeId,
        placeName: placeNameForAlert(warning, normalizedInput, placesById),
        type: warning.type,
        message: warning.message
      })),
      totalTravelMinutes: totalTravelMinutesFromItinerary(normalizedItinerary),
      totalDwellMinutes: totalDwellMinutesFromItinerary(normalizedItinerary),
      feasible: compactResult.conflicts.length === 0
    }
  };
}
