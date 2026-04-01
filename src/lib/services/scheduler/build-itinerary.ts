import type {
  Place,
  PlannerConflict,
  PlannerInput,
  PlannerResult,
  PlannerWarning,
  RouteNode,
  ScheduledVisit
} from '$lib/types/planner';
import { fullnessMultiplier, normalizePlanningDays } from '$lib/services/planner/day-settings';
import type { RoutingEngine } from '$lib/services/routing';
import { formatMinutesToTime, parseTimeToMinutes } from '$lib/services/utils';
import {
  createDayEndWarning,
  createDayEndConflict,
  createDwellConflict,
  createExplicitAfterDayEndConflict,
  createFixedTimeConflict,
  createOvernightShiftWarning,
  createPreferredDayWarning,
  createShortenedDwellWarning,
  createTightWarning,
  createTimeWindowConflict,
  createUnscheduledInfo
} from './conflicts';
import {
  hasHardExplicitDayEndConflict,
  preferredDayIndex
} from './build-itinerary-day-preferences';
import { buildRouteToHotel, createHotelNode, toRouteNode } from './build-itinerary-routing';
import { selectPlaceForDay } from './build-itinerary-selection';

export async function buildPlannerResult(
  input: PlannerInput,
  orderedPlaces: Place[],
  routingEngine: RoutingEngine
): Promise<PlannerResult> {
  const planningDays = normalizePlanningDays(input.settings);
  const itinerary: ScheduledVisit[] = [];
  const conflicts: PlannerConflict[] = [];
  const warnings: PlannerWarning[] = [];
  const remainingPlaces = [...orderedPlaces];
  const deferredFixedTimeDays = new Map<string, number>();

  let totalTravelMinutes = 0;
  let totalDwellMinutes = 0;
  let previousScheduledVisit: ScheduledVisit | undefined;
  let previousScheduledPlace: Place | undefined;
  let daysUsed = 0;

  for (const [dayIndex, planningDay] of planningDays.entries()) {
    if (remainingPlaces.length === 0) {
      break;
    }

    const dayStartMinutes = parseTimeToMinutes(planningDay.dayStart);
    const dayEndMinutes = parseTimeToMinutes(planningDay.dayEnd);
    const targetDayMinutes = Math.max(
      1,
      Math.round((dayEndMinutes - dayStartMinutes) * (planningDays.length > 1 ? fullnessMultiplier(planningDay.fullness) : 1))
    );

    let currentMinutes = dayStartMinutes;
    let previousNode: RouteNode = createHotelNode(input);
    let scheduledToday = 0;
    let lastPlaceForDay: Place | undefined;

    while (remainingPlaces.length > 0) {
      const selection = await selectPlaceForDay(
        input,
        remainingPlaces,
        planningDays,
        dayIndex,
        previousNode,
        currentMinutes,
        dayStartMinutes,
        dayEndMinutes,
        targetDayMinutes,
        deferredFixedTimeDays,
        routingEngine
      );

      if (!selection) {
        break;
      }

      const place = selection.place;
      const hardDayEndConflict = hasHardExplicitDayEndConflict(place, planningDay);
      const segment = selection.segment;
      const rawArrivalMinutes = selection.rawArrivalMinutes;
      const fixedArrival = selection.fixedArrivalMinutes;
      const availabilityEndMinutes = selection.availabilityEndMinutes;
      const windowEnd = selection.windowEndMinutes;
      const serviceStartMinutes = selection.serviceStartMinutes;
      const requestedDwellMinutes = selection.requestedDwellMinutes;
      const dwellMinutes = selection.scheduledDwellMinutes;
      const departureMinutes = selection.departureMinutes;
      const returnSegment = selection.returnSegment;

      totalTravelMinutes += segment.totalMinutes;

      if ((fixedArrival !== undefined && rawArrivalMinutes > fixedArrival) || (fixedArrival === undefined && departureMinutes > windowEnd + dwellMinutes)) {
        if (fixedArrival) {
          const lateBy = rawArrivalMinutes - fixedArrival;
          conflicts.push(createFixedTimeConflict(place, lateBy));

          if (previousScheduledVisit && previousScheduledPlace) {
            const reduced = Math.max(0, previousScheduledVisit.dwellMinutes - lateBy);
            conflicts.push(createDwellConflict(previousScheduledPlace, lateBy, reduced));
          }
        } else {
          conflicts.push(createTimeWindowConflict(place, formatMinutesToTime(serviceStartMinutes)));
        }
      }

      const recommendedLeaveByTime = formatMinutesToTime(serviceStartMinutes - segment.totalMinutes);
      const freeTimeBeforeVisitMinutes = Math.max(
        0,
        parseTimeToMinutes(recommendedLeaveByTime) - currentMinutes
      );
      const timeBuffer = fixedArrival !== undefined ? fixedArrival - rawArrivalMinutes : windowEnd + dwellMinutes - departureMinutes;
      if (timeBuffer >= 0 && timeBuffer < 15) {
        warnings.push(createTightWarning(place, timeBuffer, fixedArrival !== undefined ? 'fixed-arrival' : 'closing-time'));
      }

      if (fixedArrival !== undefined && place.constraint.closingTime && dwellMinutes < requestedDwellMinutes && dwellMinutes > 0) {
        warnings.push(
          createShortenedDwellWarning(
            place,
            requestedDwellMinutes,
            dwellMinutes,
            formatMinutesToTime(availabilityEndMinutes)
          )
        );
      }

      if (fixedArrival !== undefined && place.constraint.closingTime && dwellMinutes <= 0) {
        conflicts.push(createTimeWindowConflict(place, formatMinutesToTime(serviceStartMinutes)));
      }

      totalDwellMinutes += dwellMinutes;

      const scheduledVisit: ScheduledVisit = {
        placeId: place.id,
        placeName: place.name,
        visitType: 'place',
        dayIndex,
        dayLabel: planningDay.label,
        dayDate: planningDay.date,
        arrivalTime: formatMinutesToTime(serviceStartMinutes),
        departureTime: formatMinutesToTime(departureMinutes),
        dwellMinutes,
        windowStatus:
          serviceStartMinutes > windowEnd ? 'late' : windowEnd - serviceStartMinutes <= 15 ? 'tight' : 'on-time',
        travelFromPrevious: segment,
        recommendedLeaveByTime,
        freeTimeBeforeVisitMinutes
      };

      itinerary.push(scheduledVisit);

      const preferredIndex = preferredDayIndex(place, planningDays);
      if (preferredIndex !== null && preferredIndex !== dayIndex) {
        const preferredLabel = planningDays[preferredIndex]?.label ?? `Day ${preferredIndex + 1}`;
        warnings.push(createPreferredDayWarning(place, preferredLabel, planningDay.label));
      }

      const deferredDayIndex = deferredFixedTimeDays.get(place.id);
      if (deferredDayIndex !== undefined && deferredDayIndex !== dayIndex) {
        const deferredLabel = planningDays[deferredDayIndex]?.label ?? `Day ${deferredDayIndex + 1}`;
        warnings.push(createOvernightShiftWarning(place, deferredLabel, planningDay.label));
        deferredFixedTimeDays.delete(place.id);
      }

      previousScheduledVisit = scheduledVisit;
      previousScheduledPlace = place;
      lastPlaceForDay = place;
      currentMinutes = departureMinutes;
      previousNode = toRouteNode(place);
      scheduledToday += 1;
      remainingPlaces.splice(selection.index, 1);

      if (hardDayEndConflict) {
        conflicts.push(createExplicitAfterDayEndConflict(place, planningDay.dayEnd, hardDayEndConflict.explicitTime));
      }
    }

    if (scheduledToday > 0 && lastPlaceForDay) {
      const returnSegment = await buildRouteToHotel(input, previousNode, currentMinutes, routingEngine);
      totalTravelMinutes += returnSegment.totalMinutes;
      const hotelArrivalMinutes = currentMinutes + returnSegment.totalMinutes;

      itinerary.push({
        placeId: `hotel-return-${dayIndex + 1}`,
        placeName: input.hotel.name,
        visitType: 'return',
        dayIndex,
        dayLabel: planningDay.label,
        dayDate: planningDay.date,
        arrivalTime: formatMinutesToTime(hotelArrivalMinutes),
        departureTime: formatMinutesToTime(hotelArrivalMinutes),
        dwellMinutes: 0,
        windowStatus: hotelArrivalMinutes > dayEndMinutes ? 'late' : 'on-time',
        travelFromPrevious: returnSegment
      });

      if (hotelArrivalMinutes > dayEndMinutes) {
        const hardDayEndConflict = hasHardExplicitDayEndConflict(lastPlaceForDay, planningDay);
        if (hardDayEndConflict) {
          conflicts.push(createDayEndConflict(lastPlaceForDay, planningDay.dayEnd));
        } else {
          warnings.push(createDayEndWarning(lastPlaceForDay, planningDay.dayEnd, hotelArrivalMinutes - dayEndMinutes));
        }
      }

      daysUsed = dayIndex + 1;
    }
  }

  if (remainingPlaces.length > 0) {
    for (const place of remainingPlaces) {
      const preferredIndex = preferredDayIndex(place, planningDays);
      const preferredDayLabel = preferredIndex === null ? null : planningDays[preferredIndex]?.label;
      if (place.constraint.fixedArrival) {
        conflicts.push({
          placeId: place.id,
          placeName: place.name,
          type: 'day-end',
          message: `No space was left across the selected trip days for ${place.name}.${preferredDayLabel ? ` ${preferredDayLabel} was preferred for this stop.` : ''} Add another day or reduce fullness on earlier days.`
        });
      } else {
        warnings.push(createUnscheduledInfo(place));
      }
    }
  }

  return {
    orderedPlaces,
    modeUsed: input.settings.mode,
    preferencesUsed: input.settings.preferences ?? ['walking'],
    planningDays,
    daysUsed,
    itinerary,
    conflicts,
    warnings,
    totalTravelMinutes,
    totalDwellMinutes,
    feasible: conflicts.length === 0
  };
}
