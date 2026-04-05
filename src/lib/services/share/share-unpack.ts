import type { PlannerInput } from '$lib/types/planner';
import {
  packedCoordinates,
  type PackedPlannerInput,
  unpackCoordinates
} from './share-types';

export function unpackPlannerInput(packed: PackedPlannerInput): PlannerInput {
  const [hotelName, hotelLat, hotelLng, packedPlaces, packedSettings] = packed;
  const [tripName, dayStart, dayEnd, mode, preferences, dataSource, startDate, endDate, packedPlanningDays] = packedSettings;

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
      tripName,
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
