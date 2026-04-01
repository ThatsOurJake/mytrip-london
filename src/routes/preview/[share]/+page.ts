import type { PageLoad } from './$types';
import { decodeSharedPlannerState } from '$lib/services/share/planner-share';

export const load: PageLoad = ({ params }) => {
  const payload = decodeSharedPlannerState(params.share);

  return {
    payload,
    errorMessage: payload ? null : 'This shared itinerary link is invalid or no longer supported.'
  };
};
