import type { PlannerInput, PlannerWarning, SegmentLeg } from '$lib/types/planner';
import {
  packedCoordinates,
  type CompactSharedPlannerResult,
  type PackedLineIdentifier,
  type PackedPlannerInput,
  type PackedPlannerResult,
  type PackedSegmentLeg,
  unpackCoordinates
} from './share-types';

function unpackLineIdentifier(packed: PackedLineIdentifier): SegmentLeg['lineIdentifier'] {
  if (!packed) {
    return undefined;
  }

  const [id, name, type] = packed;
  if (!id && !name && !type) {
    return undefined;
  }

  return { id, name, type };
}

function unpackSegmentLeg(packed: PackedSegmentLeg): SegmentLeg {
  const [
    mode,
    minutes,
    distanceKm,
    description,
    originName,
    destinationName,
    lineIdentifier,
    scheduledDepartureTime,
    scheduledArrivalTime,
    intermediateStopNames
  ] = packed;

  return {
    mode,
    minutes,
    distanceKm,
    description,
    originName,
    destinationName,
    lineIdentifier: unpackLineIdentifier(lineIdentifier),
    scheduledDepartureTime,
    scheduledArrivalTime,
    intermediateStopNames
  };
}

export function unpackPlannerInput(packed: PackedPlannerInput): PlannerInput {
  const [hotelName, hotelLat, hotelLng, packedPlaces, packedSettings] = packed;
  const [dayStart, dayEnd, mode, preferences, dataSource, startDate, endDate, packedPlanningDays] = packedSettings;

  return {
    hotel: {
      name: hotelName,
      location: unpackCoordinates(packedCoordinates(hotelLat, hotelLng))
    },
    places: packedPlaces.map(
      ([
        id,
        name,
        lat,
        lng,
        minimumDwellMinutes,
        openingTime,
        closingTime,
        fixedArrival,
        preferredDayId,
        priority
      ]) => ({
        id,
        name,
        location: unpackCoordinates(packedCoordinates(lat, lng)),
        constraint: {
          minimumDwellMinutes,
          openingTime,
          closingTime,
          fixedArrival,
          preferredDayId,
          priority
        }
      })
    ),
    settings: {
      dayStart,
      dayEnd,
      mode,
      preferences,
      dataSource,
      startDate,
      endDate,
      planningDays: packedPlanningDays?.map(([id, label, date, packedDayStart, packedDayEnd, fullness]) => ({
        id,
        label,
        date,
        dayStart: packedDayStart,
        dayEnd: packedDayEnd,
        fullness,
        palette: 'blush'
      }))
    }
  };
}

export function unpackPlannerResult(packed: PackedPlannerResult): CompactSharedPlannerResult {
  const [packedItinerary, packedConflicts, packedWarnings] = packed;

  return {
    itinerary: packedItinerary.map(
      ([
        placeId,
        visitType,
        dayIndex,
        arrivalTime,
        departureTime,
        dwellMinutes,
        windowStatus,
        travelFromPrevious,
        recommendedLeaveByTime,
        freeTimeBeforeVisitMinutes
      ]) => ({
        placeId,
        visitType,
        dayIndex,
        arrivalTime,
        departureTime,
        dwellMinutes,
        windowStatus,
        recommendedLeaveByTime,
        freeTimeBeforeVisitMinutes,
        travelFromPrevious: travelFromPrevious
          ? {
            source: travelFromPrevious[0],
            totalMinutes: travelFromPrevious[1],
            distanceKm: travelFromPrevious[2],
            fareGbp: travelFromPrevious[3],
            legs: travelFromPrevious[4].map(unpackSegmentLeg)
          }
          : undefined
      })
    ),
    conflicts: packedConflicts.map(([placeId, type, message, requiredReductionMinutes]) => ({
      placeId,
      type,
      message,
      requiredReductionMinutes
    })),
    warnings: packedWarnings.map(([placeId, type, message]) => ({
      placeId,
      type: type as PlannerWarning['type'],
      message
    }))
  };
}
