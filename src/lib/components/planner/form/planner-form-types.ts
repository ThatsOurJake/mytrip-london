import type { RouteDataSource, TransitPreference, TransportPreference, TripDayFullness } from '$lib/types/planner';

export interface ActiveTravelOption {
  preference: 'walking' | 'cycling';
  label: string;
  description: string;
  icon: string;
  disabled?: boolean;
}

export interface TransitOption {
  preference: TransitPreference;
  label: string;
  description: string;
  icon: string;
}

export interface DataSourceOption {
  value: RouteDataSource;
  label: string;
  description: string;
}

export interface FullnessOption {
  value: TripDayFullness;
  label: string;
  description: string;
}

export interface PlannerFormValue {
  tripName: string;
  hotelName: string;
  hotelLat: number;
  hotelLng: number;
  dayStart: string;
  dayEnd: string;
  mode: import('$lib/types/planner').TransportMode;
  preferences: TransportPreference[];
  dataSource: RouteDataSource;
  startDate?: string;
  endDate?: string;
  planningDays: import('$lib/types/planner').TripPlanningDay[];
}

export interface PlaceDraftValue {
  name: string;
  lat: number;
  lng: number;
  minimumDwellMinutes: number;
  openingTime: string;
  closingTime: string;
  fixedArrival: string;
  preferredDayId: string;
  priority: number;
}
