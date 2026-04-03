import { formatTripContext, type TripContext } from './trip-context.js';
import type { FlowPosition } from './booking-steps.js';
import { getCategoryPrompt, getPhasePrompt } from './category-prompts.js';

export function buildSystemPrompt(
  tripContext?: TripContext,
  flowPosition?: FlowPosition,
): string {
  let stepPrompt: string;

  if (!flowPosition || flowPosition.phase === 'COLLECT_DETAILS') {
    stepPrompt = getPhasePrompt('COLLECT_DETAILS');
  } else if (flowPosition.phase === 'CATEGORY') {
    stepPrompt = getCategoryPrompt(flowPosition.category, flowPosition.status);
  } else if (flowPosition.phase === 'CONFIRM') {
    stepPrompt = getPhasePrompt('CONFIRM');
  } else {
    stepPrompt = getPhasePrompt('COMPLETE');
  }

  const parts = [stepPrompt];
  parts.push(`\n\n## Current Date\n\nToday is ${new Date().toISOString().split('T')[0]}.`);

  if (tripContext) {
    parts.push(`\n\n## Current Trip State\n\n${formatTripContext(tripContext)}`);
  }

  return parts.join('');
}
