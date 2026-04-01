import type { PlannerInput, PlannerResult } from '$lib/types/planner';
import { RoutingEngine } from '$lib/services/routing';
import { optimizePlaceOrder } from '$lib/services/optimizer/solver';
import { buildPlannerResult } from '$lib/services/scheduler/build-itinerary';

const routingEngine = new RoutingEngine();

export async function runPlanner(input: PlannerInput): Promise<PlannerResult> {
  const orderedPlaces = await optimizePlaceOrder(input, routingEngine);
  return buildPlannerResult(input, orderedPlaces, routingEngine);
}

export function clearPlannerRouteCache(): void {
  routingEngine.clearCache();
}
