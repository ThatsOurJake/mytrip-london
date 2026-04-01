import type { RouteDataSource } from '$lib/types/planner';

export const DAY_USAGE_FULL_THRESHOLD = 0.7;

export const SUMMARY_NOTE_COPY = {
  travelTime: 'Total time spent moving between stops.',
  timeAtPlaces: 'Planned time spent at places.',
  tripDays: 'Days currently used by the itinerary.',
  predictedCost: 'Summed from available TfL fare data only.'
} as const;

export const TIME_AT_PLACES_LABEL = 'Time at Places';
export const VISIT_TIME_FIELD_LABEL = 'Minimum visit time (minutes)';
export const VISIT_TIME_PLACE_INFO =
  'The least time you want to spend at this place. The planner keeps at least this many minutes in the itinerary.';
export const VISIT_TIME_STOP_INFO = 'The least time you want to spend at this stop.';

export function routeDataSourceLabel(dataSource: RouteDataSource | undefined): string {
  switch (dataSource ?? 'auto') {
    case 'tfl':
      return 'TfL';
    case 'openstreet':
      return 'OpenStreet';
    case 'heuristic':
      return 'Heuristic';
    default:
      return 'Recommended';
  }
}

export function itineraryStatusLabel(feasible: boolean): string {
  return feasible ? 'Ready to follow' : 'Needs changes';
}

export function plannedStayLabel(duration: string): string {
  return `Planned stay: ${duration}`;
}

export function visitTimeSummary(minutes: number): string {
  return `Visit time ${minutes} min`;
}
