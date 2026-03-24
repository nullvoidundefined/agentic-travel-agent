/**
 * Create tool_call_log table for observability of agent tool invocations.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable("tool_call_log", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    conversation_id: {
      type: "uuid",
      references: "conversations",
      onDelete: "SET NULL",
    },
    message_id: {
      type: "uuid",
      references: "messages",
      onDelete: "SET NULL",
    },
    tool_name: { type: "text", notNull: true },
    tool_input_json: { type: "jsonb" },
    tool_result_json: { type: "jsonb" },
    latency_ms: { type: "integer" },
    cache_hit: { type: "boolean", default: false },
    error: { type: "text" },
    created_at: { type: "timestamptz", default: pgm.func("NOW()") },
  });

  pgm.createIndex("tool_call_log", "conversation_id");
  pgm.createIndex("tool_call_log", "tool_name");
  pgm.createIndex("tool_call_log", "created_at");
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropTable("tool_call_log");
};
