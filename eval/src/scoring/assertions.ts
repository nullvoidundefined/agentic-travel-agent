import type { AssertionResults, Persona } from '../types.js';

interface AssertionInput {
  transcript: Array<{ role: string; content: string; tool_calls?: string[] }>;
  completed: boolean;
  tool_calls: string[];
  error?: string;
  persona: Persona;
  tripRecord?: Record<string, unknown> | null;
}

export function runAssertions(input: AssertionInput): AssertionResults {
  const { transcript, completed, tool_calls, error, persona, tripRecord } =
    input;

  const details_collected =
    !!tripRecord?.destination &&
    !!tripRecord?.origin &&
    !!tripRecord?.departure_date;

  const searchTools = [
    'search_flights',
    'search_hotels',
    'search_car_rentals',
    'search_experiences',
  ];
  const search_executed = tool_calls.some((tc) => searchTools.includes(tc));

  const no_errors = !error;

  const assistantMessages = transcript.filter((t) => t.role === 'assistant');
  const avgWords =
    assistantMessages.length > 0
      ? assistantMessages.reduce(
          (sum, m) => sum + m.content.split(/\s+/).length,
          0,
        ) / assistantMessages.length
      : 0;
  const response_length = avgWords <= 150;

  let budget_respected = true;
  if (persona.budget && tripRecord?.total_spent) {
    const threshold = persona.budget * 1.2;
    budget_respected = (tripRecord.total_spent as number) <= threshold;
  }

  const format_response_used = assistantMessages.every(
    (m) => m.content !== '[No text response]',
  );

  const conversation_completed = completed;

  return {
    details_collected,
    search_executed,
    no_errors,
    response_length,
    budget_respected,
    format_response_used,
    conversation_completed,
  };
}

export function computeAssertionScore(results: AssertionResults): number {
  const values = Object.values(results);
  const passed = values.filter(Boolean).length;
  return Math.round((passed / values.length) * 100) / 100;
}

export function isCriticalFailure(results: AssertionResults): boolean {
  return !results.no_errors || !results.conversation_completed;
}
