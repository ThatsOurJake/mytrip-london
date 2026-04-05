import type {
  PlannerInput,
  Coordinates
} from '$lib/types/planner';

export const SHARED_PLANNER_STATE_VERSION = 4;

export interface SharedPlannerState {
  version: number;
  input: PlannerInput;
}

export type PackedCoordinates = [lat: number, lng: number];

export type PackedPlanningDay = [
  id: string,
  label: string,
  date: string | undefined,
  dayStart: string,
  dayEnd: string,
  fullness: NonNullable<PlannerInput['settings']['planningDays']>[number]['fullness'],
  paletteIndex: number
];

export type PackedPlace = [
  id: string,
  name: string,
  lat: number,
  lng: number,
  minimumDwellMinutes: number,
  openingTime: string | undefined,
  closingTime: string | undefined,
  fixedArrival: string | undefined,
  preferredDayId: string | undefined,
  priority: number
];

export type PackedPlannerSettings = [
  tripName: string | undefined,
  dayStart: string,
  dayEnd: string,
  mode: PlannerInput['settings']['mode'],
  preferences: PlannerInput['settings']['preferences'] | undefined,
  dataSource: PlannerInput['settings']['dataSource'] | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  planningDays: PackedPlanningDay[] | undefined
];

export type PackedPlannerInput = [
  hotelName: string,
  hotelLat: number,
  hotelLng: number,
  places: PackedPlace[],
  settings: PackedPlannerSettings
];

export interface PackedEncodedSharedPlannerState {
  version: typeof SHARED_PLANNER_STATE_VERSION;
  input: PackedPlannerInput;
}

export function packedCoordinates(lat: number, lng: number): PackedCoordinates {
  return [lat, lng];
}

export function unpackCoordinates([lat, lng]: PackedCoordinates): Coordinates {
  return { lat, lng };
}
