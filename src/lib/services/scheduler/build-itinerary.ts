import type {
  Place,
  PlannerConflict,
  PlannerInput,
  PlannerResult,
  PlannerWarning,
  RouteNode,
  ScheduledVisit
} from '$lib/types/planner';
import type { RoutingEngine } from '$lib/services/routing';
import { formatMinutesToTime, parseTimeToMinutes, safeWindowEnd, safeWindowStart } from '$lib/services/utils';
import {
  createDayEndConflict,
  createDwellConflict,
  createFixedTimeConflict,
  createTightWarning,
  createTimeWindowConflict
} from './conflicts';

function toRouteNode(place: Place): RouteNode {
  return {
    id: place.id,
    name: place.name,
    location: place.location,
    constraint: place.constraint
  };
}

export async function buildPlannerResult(
  input: PlannerInput,
  orderedPlaces: Place[],
  routingEngine: RoutingEngine
): Promise<PlannerResult> {
  const itinerary: ScheduledVisit[] = [];
  const conflicts: PlannerConflict[] = [];
  const warnings: PlannerWarning[] = [];

  const dayStartMinutes = parseTimeToMinutes(input.settings.dayStart);
  const dayEndMinutes = parseTimeToMinutes(input.settings.dayEnd);

  let totalTravelMinutes = 0;
  let totalDwellMinutes = 0;
  let currentMinutes = dayStartMinutes;
  let previousNode: RouteNode = {
    id: 'hotel',
    name: input.hotel.name,
    location: input.hotel.location
  };

  for (const [index, place] of orderedPlaces.entries()) {
    const segment = await routingEngine.getSegment({
      fromId: previousNode.id,
      toId: place.id,
      fromName: previousNode.name,
      toName: place.name,
      from: previousNode.location,
      to: place.location,
      mode: input.settings.mode,
      transportPreferences: input.settings.preferences ?? ['walking'],
      dataSource: input.settings.dataSource ?? 'auto',
      departureMinutes: currentMinutes
    });

    totalTravelMinutes += segment.totalMinutes;
    const rawArrivalMinutes = currentMinutes + segment.totalMinutes;

    const fixedArrival = place.constraint.fixedArrival ? parseTimeToMinutes(place.constraint.fixedArrival) : undefined;
    const windowStart = fixedArrival ?? safeWindowStart(place.constraint.earliestArrival, dayStartMinutes);
    const windowEnd = fixedArrival ?? safeWindowEnd(place.constraint.latestArrival, dayEndMinutes);

    if (rawArrivalMinutes > windowEnd) {
      if (fixedArrival) {
        const lateBy = rawArrivalMinutes - fixedArrival;
        conflicts.push(createFixedTimeConflict(place, lateBy));

        const previousVisit = itinerary[index - 1];
        const previousPlace = orderedPlaces[index - 1];
        if (previousVisit && previousPlace) {
          const reduced = Math.max(0, previousVisit.dwellMinutes - lateBy);
          conflicts.push(createDwellConflict(previousPlace, lateBy, reduced));
        }
      } else {
        conflicts.push(createTimeWindowConflict(place, formatMinutesToTime(rawArrivalMinutes)));
      }
    }

    const serviceStartMinutes = Math.max(rawArrivalMinutes, windowStart);
    const freeTimeBeforeVisitMinutes = Math.max(0, serviceStartMinutes - rawArrivalMinutes);
    const recommendedLeaveByTime = formatMinutesToTime(serviceStartMinutes - segment.totalMinutes);
    const timeBuffer = windowEnd - serviceStartMinutes;
    if (timeBuffer >= 0 && timeBuffer <= 15) {
      warnings.push(createTightWarning(place, timeBuffer));
    }

    const dwellMinutes = place.constraint.minimumDwellMinutes;
    totalDwellMinutes += dwellMinutes;
    const departureMinutes = serviceStartMinutes + dwellMinutes;

    itinerary.push({
      placeId: place.id,
      placeName: place.name,
      visitType: 'place',
      arrivalTime: formatMinutesToTime(serviceStartMinutes),
      departureTime: formatMinutesToTime(departureMinutes),
      dwellMinutes,
      windowStatus:
        serviceStartMinutes > windowEnd ? 'late' : windowEnd - serviceStartMinutes <= 15 ? 'tight' : 'on-time',
      travelFromPrevious: segment,
      recommendedLeaveByTime,
      freeTimeBeforeVisitMinutes
    });

    currentMinutes = departureMinutes;
    previousNode = toRouteNode(place);
  }

  if (orderedPlaces.length > 0) {
    const returnSegment = await routingEngine.getSegment({
      fromId: previousNode.id,
      toId: 'hotel',
      fromName: previousNode.name,
      toName: input.hotel.name,
      from: previousNode.location,
      to: input.hotel.location,
      mode: input.settings.mode,
      transportPreferences: input.settings.preferences ?? ['walking'],
      dataSource: input.settings.dataSource ?? 'auto',
      departureMinutes: currentMinutes
    });

    totalTravelMinutes += returnSegment.totalMinutes;
    const hotelArrivalMinutes = currentMinutes + returnSegment.totalMinutes;

    itinerary.push({
      placeId: 'hotel-return',
      placeName: input.hotel.name,
      visitType: 'return',
      arrivalTime: formatMinutesToTime(hotelArrivalMinutes),
      departureTime: formatMinutesToTime(hotelArrivalMinutes),
      dwellMinutes: 0,
      windowStatus: hotelArrivalMinutes > dayEndMinutes ? 'late' : 'on-time',
      travelFromPrevious: returnSegment
    });

    currentMinutes = hotelArrivalMinutes;
  }

  const lastPlace = orderedPlaces[orderedPlaces.length - 1];
  if (lastPlace && currentMinutes > dayEndMinutes) {
    conflicts.push(createDayEndConflict(lastPlace, input.settings.dayEnd));
  }

  return {
    orderedPlaces,
    modeUsed: input.settings.mode,
    preferencesUsed: input.settings.preferences ?? ['walking'],
    itinerary,
    conflicts,
    warnings,
    totalTravelMinutes,
    totalDwellMinutes,
    feasible: conflicts.length === 0
  };
}
