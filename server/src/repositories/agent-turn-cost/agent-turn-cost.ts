import { query } from 'app/db/pool/pool.js';

/**
 * Sonnet 4 pricing (as of 2026-04-06 audit). Update when Anthropic
 * changes its pricing. Units are dollars per million tokens.
 */
export const SONNET_4_INPUT_USD_PER_MTOK = 3;
export const SONNET_4_OUTPUT_USD_PER_MTOK = 15;

export interface AgentTurnCostInput {
  conversation_id: string;
  message_id?: string | null;
  input_tokens: number;
  output_tokens: number;
  iterations: number;
  tool_call_count: number;
}

/**
 * Compute estimated cost in USD from token counts using Sonnet 4
 * pricing. Returns a number with up to 6 decimal places of precision,
 * which matches the numeric(10,6) column type.
 */
export function estimateCostUsd(
  inputTokens: number,
  outputTokens: number,
): number {
  const input = (inputTokens / 1_000_000) * SONNET_4_INPUT_USD_PER_MTOK;
  const output = (outputTokens / 1_000_000) * SONNET_4_OUTPUT_USD_PER_MTOK;
  return Math.round((input + output) * 1_000_000) / 1_000_000;
}

/**
 * Insert one row recording the aggregate token cost of a completed
 * agent-loop turn.
 */
export async function insertAgentTurnCost(
  input: AgentTurnCostInput,
): Promise<void> {
  const cost = estimateCostUsd(input.input_tokens, input.output_tokens);
  await query(
    `INSERT INTO agent_turn_cost
       (conversation_id, message_id, input_tokens, output_tokens,
        estimated_cost_usd, iterations, tool_call_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.conversation_id,
      input.message_id ?? null,
      input.input_tokens,
      input.output_tokens,
      cost,
      input.iterations,
      input.tool_call_count,
    ],
  );
}
