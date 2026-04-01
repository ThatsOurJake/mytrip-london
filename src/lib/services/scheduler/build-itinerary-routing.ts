import type { RoutingEngine } from '$lib/services/routing';
import type { Place, PlannerInput, RouteNode } from '$lib/types/planner';

export function toRouteNode(place: Place): RouteNode {
  return {
    id: place.id,
    name: place.name,
    location: place.location,
    constraint: place.constraint
  };
}

export function createHotelNode(input: PlannerInput): RouteNode {
  return {
    id: 'hotel',
    name: input.hotel.name,
    location: input.hotel.location
  };
}

export async function buildRouteToHotel(
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
