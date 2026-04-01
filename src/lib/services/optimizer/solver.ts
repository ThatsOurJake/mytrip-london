import type { Place, PlannerInput, RouteDataSource, RouteNode, TransportMode } from '$lib/types/planner';
import type { RoutingEngine } from '$lib/services/routing';
import { parseTimeToMinutes, safeWindowEnd, safeWindowStart } from '$lib/services/utils';

interface CandidateScore {
  place: Place;
  score: number;
  arrivalMinutes: number;
  serviceStartMinutes: number;
}

function lookupPreferences(input: PlannerInput) {
  return input.settings.preferences ?? ['walking'];
}

function createHotelNode(input: PlannerInput): RouteNode {
  return {
    id: 'hotel',
    name: input.hotel.name,
    location: input.hotel.location
  };
}

function priorityBoost(priority: number): number {
  return Math.max(0, Math.min(priority, 10)) * 3;
}

async function scoreCandidate(
  candidate: Place,
  fromNode: RouteNode,
  currentMinutes: number,
  mode: TransportMode,
  transportPreferences: PlannerInput['settings']['preferences'],
  dataSource: RouteDataSource,
  dayStartMinutes: number,
  dayEndMinutes: number,
  routingEngine: RoutingEngine
): Promise<CandidateScore> {
  const segment = await routingEngine.getSegment({
    fromId: fromNode.id,
    toId: candidate.id,
    fromName: fromNode.name,
    toName: candidate.name,
    from: fromNode.location,
    to: candidate.location,
    mode,
    transportPreferences: transportPreferences ?? ['walking'],
    dataSource,
    departureMinutes: currentMinutes
  });

  const arrival = currentMinutes + segment.totalMinutes;
  const dwellMinutes = candidate.constraint.minimumDwellMinutes;
  const fixedArrival = candidate.constraint.fixedArrival
    ? parseTimeToMinutes(candidate.constraint.fixedArrival)
    : undefined;
  const windowStart = fixedArrival ?? safeWindowStart(candidate.constraint.openingTime, dayStartMinutes);
  const availabilityEnd = fixedArrival ?? safeWindowEnd(candidate.constraint.closingTime, dayEndMinutes);
  const serviceStartMinutes = Math.max(arrival, windowStart);
  const projectedDepartureMinutes = serviceStartMinutes + dwellMinutes;
  const waitingPenalty = Math.max(0, windowStart - arrival) * 0.25;
  const latenessPenalty = Math.max(0, projectedDepartureMinutes - availabilityEnd) * 10;
  const score = segment.totalMinutes + waitingPenalty + latenessPenalty - priorityBoost(candidate.constraint.priority);

  return {
    place: candidate,
    score,
    arrivalMinutes: arrival,
    serviceStartMinutes
  };
}

export async function optimizePlaceOrder(input: PlannerInput, routingEngine: RoutingEngine): Promise<Place[]> {
  const remaining = [...input.places];
  const ordered: Place[] = [];
  const dayStartMinutes = parseTimeToMinutes(input.settings.dayStart);
  const dayEndMinutes = parseTimeToMinutes(input.settings.dayEnd);

  let currentNode: RouteNode = createHotelNode(input);
  let currentMinutes = dayStartMinutes;

  while (remaining.length > 0) {
    const scoredCandidates = await Promise.all(
      remaining.map((candidate) =>
        scoreCandidate(
          candidate,
          currentNode,
          currentMinutes,
          input.settings.mode,
          lookupPreferences(input),
          input.settings.dataSource ?? 'auto',
          dayStartMinutes,
          dayEndMinutes,
          routingEngine
        )
      )
    );

    scoredCandidates.sort((a, b) => a.score - b.score);
    const next = scoredCandidates[0];
    if (!next) {
      break;
    }

    ordered.push(next.place);
    remaining.splice(
      remaining.findIndex((place) => place.id === next.place.id),
      1
    );

    const fixedArrival = next.place.constraint.fixedArrival
      ? parseTimeToMinutes(next.place.constraint.fixedArrival)
      : undefined;
    const serviceStart = fixedArrival ? Math.max(next.arrivalMinutes, fixedArrival) : next.serviceStartMinutes;

    currentMinutes = serviceStart + next.place.constraint.minimumDwellMinutes;
    currentNode = {
      id: next.place.id,
      name: next.place.name,
      location: next.place.location,
      constraint: next.place.constraint
    };
  }

  return ordered;
}
