import type { PlannerInput, PlannerResult, RouteSegment, SegmentLeg } from '$lib/types/planner';
import {
  type PackedEncodedSharedPlannerState,
  type PackedLineIdentifier,
  type PackedPlannerInput,
  type PackedPlannerResult,
  type PackedRouteSegment,
  type PackedSegmentLeg,
  SHARED_PLANNER_STATE_VERSION
} from './share-types';

function packLineIdentifier(leg: SegmentLeg): PackedLineIdentifier {
  if (!leg.lineIdentifier) {
    return undefined;
  }

  return [leg.lineIdentifier.id, leg.lineIdentifier.name, leg.lineIdentifier.type];
}

function packSegmentLeg(leg: SegmentLeg): PackedSegmentLeg {
  return [
    leg.mode,
    leg.minutes,
    leg.distanceKm,
    leg.description,
    leg.originName,
    leg.destinationName,
    packLineIdentifier(leg),
    leg.scheduledDepartureTime,
    leg.scheduledArrivalTime,
    leg.intermediateStopNames
  ];
}

function packRouteSegment(segment: RouteSegment): PackedRouteSegment {
  return [segment.source, segment.totalMinutes, segment.distanceKm, segment.fareGbp, segment.legs.map(packSegmentLeg)];
}

function compactPlannerInput(input: PlannerInput): PlannerInput {
  return {
    ...input,
    settings: {
      ...input.settings,
      planningDays: input.settings.planningDays?.map(({ palette: _palette, ...day }) =>
        day as NonNullable<PlannerInput['settings']['planningDays']>[number]
      )
    }
  };
}

export function packPlannerInput(input: PlannerInput): PackedPlannerInput {
  const compactInput = compactPlannerInput(input);

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
        day.fullness
      ])
    ]
  ];
}

export function packPlannerResult(result: PlannerResult): PackedPlannerResult {
  return [
    result.itinerary.map((visit) => [
      visit.placeId,
      visit.visitType,
      visit.dayIndex,
      visit.arrivalTime,
      visit.departureTime,
      visit.dwellMinutes,
      visit.windowStatus,
      visit.travelFromPrevious ? packRouteSegment(visit.travelFromPrevious) : undefined,
      visit.recommendedLeaveByTime,
      visit.freeTimeBeforeVisitMinutes
    ]),
    result.conflicts.map((conflict) => [
      conflict.placeId,
      conflict.type,
      conflict.message,
      conflict.requiredReductionMinutes
    ]),
    result.warnings.map((warning) => [warning.placeId, warning.type, warning.message])
  ];
}

export function createPackedEncodedSharedPlannerState(
  input: PlannerInput,
  result: PlannerResult
): PackedEncodedSharedPlannerState {
  return {
    version: SHARED_PLANNER_STATE_VERSION,
    input: packPlannerInput(input),
    result: packPlannerResult(result)
  };
}
