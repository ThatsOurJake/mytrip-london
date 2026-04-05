import type { PageLoad } from './$types';
import { decodeSharedPlannerState } from '$lib/services/share/planner-share';

export const load: PageLoad = ({ params }) => {
  const payload = decodeSharedPlannerState(params.id);

  return {
    shareId: params.id,
    payload,
    errorMessage: payload ? null : 'This shared trip link is invalid or no longer supported.'
  };
};