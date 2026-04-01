import type {
  Coordinates,
  PlannerConflict,
  PlannerInput,
  PlannerResult,
  PlannerWarning,
  RouteSegment,
  ScheduledVisit,
  SegmentLeg
} from '$lib/types/planner';

export const SHARED_PLANNER_STATE_VERSION = 2;

export interface SharedPlannerState {
  version: number;
  input: PlannerInput;
  result: PlannerResult;
}

export type PackedCoordinates = [lat: number, lng: number];

export type PackedPlanningDay = [
  id: string,
  label: string,
  date: string | undefined,
  dayStart: string,
  dayEnd: string,
  fullness: NonNullable<PlannerInput['settings']['planningDays']>[number]['fullness']
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

export type PackedLineIdentifier = [id: string | undefined, name: string | undefined, type: string | undefined] | undefined;

export type PackedSegmentLeg = [
  mode: SegmentLeg['mode'],
  minutes: number,
  distanceKm: number,
  description: string,
  originName: string | undefined,
  destinationName: string | undefined,
  lineIdentifier: PackedLineIdentifier,
  scheduledDepartureTime: string | undefined,
  scheduledArrivalTime: string | undefined,
  intermediateStopNames: string[] | undefined
];

export type PackedRouteSegment = [
  source: string,
  totalMinutes: number,
  distanceKm: number,
  fareGbp: number | null | undefined,
  legs: PackedSegmentLeg[]
];

export type PackedScheduledVisit = [
  placeId: string,
  visitType: ScheduledVisit['visitType'],
  dayIndex: number,
  arrivalTime: string,
  departureTime: string,
  dwellMinutes: number,
  windowStatus: ScheduledVisit['windowStatus'],
  travelFromPrevious: PackedRouteSegment | undefined,
  recommendedLeaveByTime: string | undefined,
  freeTimeBeforeVisitMinutes: number | undefined
];

export type PackedConflict = [
  placeId: string,
  type: PlannerConflict['type'],
  message: string,
  requiredReductionMinutes: number | undefined
];

export type PackedWarning = [
  placeId: string,
  type: PlannerWarning['type'],
  message: string
];

export type PackedPlannerResult = [
  itinerary: PackedScheduledVisit[],
  conflicts: PackedConflict[],
  warnings: PackedWarning[]
];

export interface PackedEncodedSharedPlannerState {
  version: typeof SHARED_PLANNER_STATE_VERSION;
  input: PackedPlannerInput;
  result: PackedPlannerResult;
}

export interface CompactSharedRouteSegment {
  source: string;
  totalMinutes: number;
  distanceKm: number;
  fareGbp?: number | null;
  legs: SegmentLeg[];
}

export interface CompactSharedVisit {
  placeId: string;
  visitType: ScheduledVisit['visitType'];
  dayIndex: number;
  arrivalTime: string;
  departureTime: string;
  dwellMinutes: number;
  windowStatus: ScheduledVisit['windowStatus'];
  travelFromPrevious?: CompactSharedRouteSegment;
  recommendedLeaveByTime?: string;
  freeTimeBeforeVisitMinutes?: number;
  placeName?: string;
  dayLabel?: string;
  dayDate?: string;
}

export interface CompactSharedConflict {
  placeId: string;
  type: PlannerConflict['type'];
  message: string;
  requiredReductionMinutes?: number;
  placeName?: string;
}

export interface CompactSharedWarning {
  placeId: string;
  type: PlannerWarning['type'];
  message: string;
  placeName?: string;
}

export interface CompactSharedPlannerResult {
  itinerary: CompactSharedVisit[];
  conflicts: CompactSharedConflict[];
  warnings: CompactSharedWarning[];
}

export function packedCoordinates(lat: number, lng: number): PackedCoordinates {
  return [lat, lng];
}

export function unpackCoordinates([lat, lng]: PackedCoordinates): Coordinates {
  return { lat, lng };
}

export type SharedRouteSegment = Omit<RouteSegment, 'geometry' | 'fromId' | 'toId'>;
