import type { RoutingEngine } from '$lib/services/routing';
import { parseTimeToMinutes, safeWindowEnd, safeWindowStart } from '$lib/services/utils';
import type { Place, PlannerInput, RouteNode, TripPlanningDay } from '$lib/types/planner';
import {
  overflowShouldMoveToLaterDay,
  preferredDayBucket,
  shouldDeferFixedStop
} from './build-itinerary-day-preferences';
import { buildRouteToHotel, toRouteNode } from './build-itinerary-routing';
import type { CandidateSelection } from './build-itinerary-types';

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
  const fixedArrivalMinutes = place.constraint.fixedArrival
    ? parseTimeToMinutes(place.constraint.fixedArrival)
    : undefined;
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

export async function selectPlaceForDay(
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

      if (
        overflowShouldMoveToLaterDay(selection, dayIndex, planningDays, dayEndMinutes, targetDayMinutes)
      ) {
        continue;
      }

      acceptableSelections.push(selection);
    }

    acceptableSelections.sort(compareSelections);
    const nextFixedSelection = acceptableSelections
      .filter(
        (selection) =>
          selection.fixedArrivalMinutes !== undefined && selection.fixedArrivalMinutes > currentMinutes
      )
      .sort((a, b) => (a.fixedArrivalMinutes ?? 0) - (b.fixedArrivalMinutes ?? 0))[0];

    if (nextFixedSelection) {
      const gapFillSelection = await chooseGapFillSelection(
        acceptableSelections,
        input,
        nextFixedSelection,
        routingEngine
      );
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
