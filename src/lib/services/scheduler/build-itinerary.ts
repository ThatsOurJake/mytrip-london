import type {
  Place,
  PlannerConflict,
  PlannerInput,
  PlannerResult,
  PlannerWarning,
  RouteSegment,
  RouteNode,
  ScheduledVisit,
  TripPlanningDay
} from '$lib/types/planner';
import { fullnessMultiplier, normalizePlanningDays } from '$lib/services/planner/day-settings';
import type { RoutingEngine } from '$lib/services/routing';
import { formatMinutesToTime, parseTimeToMinutes, safeWindowEnd, safeWindowStart } from '$lib/services/utils';
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

function toRouteNode(place: Place): RouteNode {
  return {
    id: place.id,
    name: place.name,
    location: place.location,
    constraint: place.constraint
  };
}

function createHotelNode(input: PlannerInput): RouteNode {
  return {
    id: 'hotel',
    name: input.hotel.name,
    location: input.hotel.location
  };
}

async function buildRouteToHotel(
  input: PlannerInput,
  fromNode: RouteNode,
  departureMinutes: number,
  routingEngine: RoutingEngine
) {
  return routingEngine.getSegment({
    fromId: fromNode.id,
    toId: 'hotel',
    fromName: fromNode.name,
    toName: input.hotel.name,
    from: fromNode.location,
    to: input.hotel.location,
    mode: input.settings.mode,
    transportPreferences: input.settings.preferences ?? ['walking'],
    dataSource: input.settings.dataSource ?? 'auto',
    departureMinutes
  });
}

interface CandidateSelection {
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

function explicitAnchorMinutes(place: Place, selection: CandidateSelection): number | null {
  if (selection.fixedArrivalMinutes !== undefined) {
    return selection.fixedArrivalMinutes;
  }

  if (place.constraint.openingTime) {
    return selection.windowStartMinutes;
  }

  if (place.constraint.closingTime) {
    return selection.windowEndMinutes + selection.requestedDwellMinutes;
  }

  return null;
}

function compareSelections(a: CandidateSelection, b: CandidateSelection): number {
  const aAnchor = explicitAnchorMinutes(a.place, a);
  const bAnchor = explicitAnchorMinutes(b.place, b);
  const aHasAnchor = aAnchor !== null;
  const bHasAnchor = bAnchor !== null;

  if (aHasAnchor !== bHasAnchor) {
    return aHasAnchor ? -1 : 1;
  }

  if (aAnchor !== null && bAnchor !== null && aAnchor !== bAnchor) {
    return aAnchor - bAnchor;
  }

  if (a.place.constraint.priority !== b.place.constraint.priority) {
    return b.place.constraint.priority - a.place.constraint.priority;
  }

  if (a.serviceStartMinutes !== b.serviceStartMinutes) {
    return a.serviceStartMinutes - b.serviceStartMinutes;
  }

  return a.projectedDayMinutes - b.projectedDayMinutes;
}

function compareGapFillSelections(a: CandidateSelection, b: CandidateSelection): number {
  if (a.place.constraint.priority !== b.place.constraint.priority) {
    return b.place.constraint.priority - a.place.constraint.priority;
  }

  if (a.departureMinutes !== b.departureMinutes) {
    return a.departureMinutes - b.departureMinutes;
  }

  return a.projectedDayMinutes - b.projectedDayMinutes;
}

async function chooseGapFillSelection(
  acceptableSelections: CandidateSelection[],
  input: PlannerInput,
  nextFixedSelection: CandidateSelection,
  routingEngine: RoutingEngine
): Promise<CandidateSelection | null> {
  const fillerSelections = acceptableSelections.filter(
    (selection) => selection.place.id !== nextFixedSelection.place.id && selection.fixedArrivalMinutes === undefined
  );

  if (fillerSelections.length === 0 || nextFixedSelection.fixedArrivalMinutes === undefined) {
    return null;
  }

  const feasibleSelections: CandidateSelection[] = [];

  for (const selection of fillerSelections) {
    const onwardSegment = await routingEngine.getSegment({
      fromId: selection.place.id,
      toId: nextFixedSelection.place.id,
      fromName: selection.place.name,
      toName: nextFixedSelection.place.name,
      from: selection.place.location,
      to: nextFixedSelection.place.location,
      mode: input.settings.mode,
      transportPreferences: input.settings.preferences ?? ['walking'],
      dataSource: input.settings.dataSource ?? 'auto',
      departureMinutes: selection.departureMinutes
    });

    const arrivalAtFixed = selection.departureMinutes + onwardSegment.totalMinutes;
    if (arrivalAtFixed <= nextFixedSelection.fixedArrivalMinutes) {
      feasibleSelections.push(selection);
    }
  }

  feasibleSelections.sort(compareGapFillSelections);
  return feasibleSelections[0] ?? null;
}

function hasHardExplicitDayEndConflict(place: Place, planningDay: TripPlanningDay): { explicitTime: string } | null {
  const dayEndMinutes = parseTimeToMinutes(planningDay.dayEnd);
  const explicitTime = place.constraint.fixedArrival;
  if (!explicitTime) {
    return null;
  }

  return parseTimeToMinutes(explicitTime) > dayEndMinutes ? { explicitTime } : null;
}

function preferredDayIndex(place: Place, planningDays: TripPlanningDay[]): number | null {
  if (!place.constraint.preferredDayId) {
    return null;
  }

  const index = planningDays.findIndex((day) => day.id === place.constraint.preferredDayId);
  return index >= 0 ? index : null;
}

function preferredDayBucket(place: Place, planningDays: TripPlanningDay[], dayIndex: number): number | null {
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

function isPinnedToCurrentDay(place: Place, planningDays: TripPlanningDay[], dayIndex: number): boolean {
  return preferredDayIndex(place, planningDays) === dayIndex;
}

async function evaluateCandidate(
  input: PlannerInput,
  place: Place,
  previousNode: RouteNode,
  currentMinutes: number,
  dayStartMinutes: number,
  dayEndMinutes: number,
  routingEngine: RoutingEngine
): Promise<CandidateSelection> {
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

  const rawArrivalMinutes = currentMinutes + segment.totalMinutes;
  const requestedDwellMinutes = place.constraint.minimumDwellMinutes;
  const fixedArrivalMinutes = place.constraint.fixedArrival ? parseTimeToMinutes(place.constraint.fixedArrival) : undefined;
  const windowStartMinutes = fixedArrivalMinutes ?? safeWindowStart(place.constraint.openingTime, dayStartMinutes);
  const availabilityEndMinutes = safeWindowEnd(place.constraint.closingTime, dayEndMinutes);
  const serviceStartMinutes = Math.max(rawArrivalMinutes, windowStartMinutes);
  const scheduledDwellMinutes =
    fixedArrivalMinutes !== undefined && place.constraint.closingTime
      ? Math.max(0, Math.min(requestedDwellMinutes, availabilityEndMinutes - serviceStartMinutes))
      : requestedDwellMinutes;
  const departureMinutes = serviceStartMinutes + scheduledDwellMinutes;
  const returnSegment = await buildRouteToHotel(input, toRouteNode(place), departureMinutes, routingEngine);

  return {
    place,
    index: -1,
    segment,
    rawArrivalMinutes,
    fixedArrivalMinutes,
    availabilityEndMinutes,
    windowStartMinutes,
    windowEndMinutes: fixedArrivalMinutes ?? availabilityEndMinutes - requestedDwellMinutes,
    serviceStartMinutes,
    requestedDwellMinutes,
    scheduledDwellMinutes,
    departureMinutes,
    returnSegment,
    projectedDayMinutes: departureMinutes + returnSegment.totalMinutes - dayStartMinutes
  };
}

function shouldDeferFixedStop(selection: CandidateSelection, dayIndex: number, planningDays: TripPlanningDay[]): boolean {
  if (isPinnedToCurrentDay(selection.place, planningDays, dayIndex)) {
    return false;
  }

  return selection.fixedArrivalMinutes !== undefined && selection.rawArrivalMinutes > selection.fixedArrivalMinutes && dayIndex < planningDays.length - 1;
}

function overflowShouldMoveToLaterDay(
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

async function selectPlaceForDay(
  input: PlannerInput,
  remainingPlaces: Place[],
  planningDays: TripPlanningDay[],
  dayIndex: number,
  previousNode: RouteNode,
  currentMinutes: number,
  dayStartMinutes: number,
  dayEndMinutes: number,
  targetDayMinutes: number,
  deferredFixedTimeDays: Map<string, number>,
  routingEngine: RoutingEngine
): Promise<CandidateSelection | null> {
  for (const bucket of [0, 1, 2]) {
    const acceptableSelections: CandidateSelection[] = [];

    for (const [index, place] of remainingPlaces.entries()) {
      if (preferredDayBucket(place, planningDays, dayIndex) !== bucket) {
        continue;
      }

      const selection = await evaluateCandidate(
        input,
        place,
        previousNode,
        currentMinutes,
        dayStartMinutes,
        dayEndMinutes,
        routingEngine
      );

      selection.index = index;

      if (shouldDeferFixedStop(selection, dayIndex, planningDays)) {
        if (!deferredFixedTimeDays.has(place.id)) {
          deferredFixedTimeDays.set(place.id, dayIndex);
        }
        continue;
      }

      if (overflowShouldMoveToLaterDay(selection, dayIndex, planningDays, dayEndMinutes, targetDayMinutes)) {
        continue;
      }

      acceptableSelections.push(selection);
    }

    acceptableSelections.sort(compareSelections);
    const nextFixedSelection = acceptableSelections
      .filter((selection) => selection.fixedArrivalMinutes !== undefined && selection.fixedArrivalMinutes > currentMinutes)
      .sort((a, b) => (a.fixedArrivalMinutes ?? 0) - (b.fixedArrivalMinutes ?? 0))[0];

    if (nextFixedSelection) {
      const gapFillSelection = await chooseGapFillSelection(acceptableSelections, input, nextFixedSelection, routingEngine);
      if (gapFillSelection) {
        return gapFillSelection;
      }
    }

    const bestSelection = acceptableSelections[0];
    if (bestSelection) {
      return bestSelection;
    }
  }

  return null;
}

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

      const freeTimeBeforeVisitMinutes = Math.max(0, serviceStartMinutes - rawArrivalMinutes);
      const recommendedLeaveByTime = formatMinutesToTime(serviceStartMinutes - segment.totalMinutes);
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
