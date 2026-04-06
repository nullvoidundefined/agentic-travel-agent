/**
 * FIN-04 (2026-04-06 audit): create agent_turn_cost table.
 *
 * The Financial audit flagged that token usage is computed by the
 * orchestrator but never persisted. `tool_call_log.cache_hit` was
 * hardcoded to `false`. There was no way to compute estimate-vs-actual
 * cost per user or per agent turn.
 *
 * This table stores one row per completed agent loop run with:
 * - the conversation and (optional) message
 * - aggregate input and output token counts from the orchestrator
 * - estimated cost in USD (computed at insert time from token counts
 *   and current Sonnet 4 pricing: $3/MTok input, $15/MTok output)
 * - iteration count (how many tool-use loops the turn consumed)
 * - tool call count (number of individual tool invocations)
 *
 * Why a new table instead of adding columns to tool_call_log:
 * token usage is a PER TURN concept (Claude's API returns input
 * and output counts per completion, not per tool call), whereas
 * tool_call_log has one row per individual tool invocation.
 * Putting tokens on tool_call_log would either duplicate the totals
 * across rows or split them arbitrarily. A separate turn-level
 * table is cleaner and easier to query for cost reports.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable('agent_turn_cost', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    conversation_id: {
      type: 'uuid',
      notNull: true,
      references: 'conversations',
      onDelete: 'CASCADE',
    },
    message_id: {
      type: 'uuid',
      references: 'messages',
      onDelete: 'SET NULL',
    },
    input_tokens: { type: 'integer', notNull: true, default: 0 },
    output_tokens: { type: 'integer', notNull: true, default: 0 },
    estimated_cost_usd: {
      type: 'numeric(10, 6)',
      notNull: true,
      default: 0,
    },
    iterations: { type: 'integer', notNull: true, default: 0 },
    tool_call_count: { type: 'integer', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });

  pgm.createIndex('agent_turn_cost', 'conversation_id');
  pgm.createIndex('agent_turn_cost', 'created_at');
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropTable('agent_turn_cost');
};
