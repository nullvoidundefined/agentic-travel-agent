import { formatTripContext, type TripContext } from './trip-context.js';
import { type BookingStep, getStepPrompt } from './booking-steps.js';

export function buildSystemPrompt(
  tripContext?: TripContext,
  step?: BookingStep,
): string {
  const stepPrompt = getStepPrompt(step ?? 'COLLECT_DETAILS');
  const parts = [stepPrompt];
  parts.push(`\n\n## Current Date\n\nToday is ${new Date().toISOString().split('T')[0]}.`);
  if (tripContext) {
    parts.push(`\n\n## Current Trip State\n\n${formatTripContext(tripContext)}`);
  }
  return parts.join('');
}
