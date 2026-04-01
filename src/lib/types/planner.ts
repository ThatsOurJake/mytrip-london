export type TransportMode = 'walking' | 'cycling' | 'mixed';

export const ROUTE_DATA_SOURCES = ['auto', 'tfl', 'openstreet', 'heuristic'] as const;

export type RouteDataSource = (typeof ROUTE_DATA_SOURCES)[number];

export const TRIP_DAY_FULLNESS = ['light', 'balanced', 'full', 'packed'] as const;

export type TripDayFullness = (typeof TRIP_DAY_FULLNESS)[number];

export const TRIP_DAY_PALETTES = ['blush', 'peach', 'butter', 'mint', 'sky', 'lavender', 'mist'] as const;

export type TripDayPalette = (typeof TRIP_DAY_PALETTES)[number];

export const TRANSIT_PREFERENCES = ['tube', 'bus', 'train', 'elizabeth'] as const;

export type TransitPreference = (typeof TRANSIT_PREFERENCES)[number];

export type TransportPreference = 'walking' | 'cycling' | TransitPreference;

export type SegmentMode = 'walk' | 'cycle' | 'transit' | 'wait';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Hotel {
  name: string;
  location: Coordinates;
}

export interface PlaceConstraint {
  minimumDwellMinutes: number;
  openingTime?: string;
  closingTime?: string;
  fixedArrival?: string;
  preferredDayId?: string;
  priority: number;
}

export interface Place {
  id: string;
  name: string;
  location: Coordinates;
  constraint: PlaceConstraint;
}

export interface PlannerSettings {
  dayStart: string;
  dayEnd: string;
  mode: TransportMode;
  preferences?: TransportPreference[];
  dataSource?: RouteDataSource;
  startDate?: string;
  endDate?: string;
  planningDays?: TripPlanningDay[];
}

export interface TripPlanningDay {
  id: string;
  label: string;
  date?: string;
  dayStart: string;
  dayEnd: string;
  fullness: TripDayFullness;
  palette: TripDayPalette;
}

export interface PlannerInput {
  hotel: Hotel;
  places: Place[];
  settings: PlannerSettings;
}

export interface RouteSegment {
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  fromLocation: Coordinates;
  toLocation: Coordinates;
  source: string;
  totalMinutes: number;
  distanceKm: number;
  fareGbp?: number | null;
  geometry?: Coordinates[];
  legs: SegmentLeg[];
}

export interface TransitLineIdentifier {
  id?: string;
  name?: string;
  type?: string;
}

export interface SegmentLeg {
  mode: SegmentMode;
  minutes: number;
  distanceKm: number;
  description: string;
  originName?: string;
  destinationName?: string;
  lineIdentifier?: TransitLineIdentifier;
  scheduledDepartureTime?: string;
  scheduledArrivalTime?: string;
  intermediateStopNames?: string[];
}

export interface RouteNode {
  id: string;
  name: string;
  location: Coordinates;
  constraint?: PlaceConstraint;
}

export interface ScheduledVisit {
  placeId: string;
  placeName: string;
  visitType: 'place' | 'return';
  dayIndex: number;
  dayLabel: string;
  dayDate?: string;
  arrivalTime: string;
  departureTime: string;
  dwellMinutes: number;
  windowStatus: 'on-time' | 'late' | 'tight';
  travelFromPrevious?: RouteSegment;
  recommendedLeaveByTime?: string;
  freeTimeBeforeVisitMinutes?: number;
}

export interface PlannerConflict {
  placeId: string;
  placeName: string;
  type: 'fixed-time' | 'time-window' | 'minimum-dwell' | 'day-end';
  message: string;
  requiredReductionMinutes?: number;
}

export interface PlannerWarning {
  placeId: string;
  placeName: string;
  type: 'tight-window' | 'preferred-day' | 'overnight-shift' | 'day-end' | 'unscheduled' | 'shortened-dwell';
  message: string;
}

export interface PlannerResult {
  orderedPlaces: Place[];
  modeUsed: TransportMode;
  preferencesUsed: TransportPreference[];
  planningDays: TripPlanningDay[];
  daysUsed: number;
  itinerary: ScheduledVisit[];
  conflicts: PlannerConflict[];
  warnings: PlannerWarning[];
  totalTravelMinutes: number;
  totalDwellMinutes: number;
  feasible: boolean;
}

export interface SavedPlannerState {
  version: number;
  input: PlannerInput;
  updatedAt: string;
}

export const PLANNER_STORAGE_VERSION = 1;
