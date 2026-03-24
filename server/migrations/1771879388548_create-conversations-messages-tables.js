/**
 * Create conversations and messages tables for chat history persistence.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createType("message_role", ["user", "assistant", "tool"]);

  pgm.createTable("conversations", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    trip_id: {
      type: "uuid",
      notNull: true,
      references: "trips",
      onDelete: "CASCADE",
      unique: true,
    },
    created_at: { type: "timestamptz", default: pgm.func("NOW()") },
    updated_at: { type: "timestamptz", default: pgm.func("NOW()") },
  });

  pgm.createIndex("conversations", "trip_id");
  pgm.sql(`
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  pgm.createTable("messages", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    conversation_id: {
      type: "uuid",
      notNull: true,
      references: "conversations",
      onDelete: "CASCADE",
    },
    role: { type: "message_role", notNull: true },
    content: { type: "text" },
    tool_calls_json: { type: "jsonb" },
    token_count: { type: "integer" },
    created_at: { type: "timestamptz", default: pgm.func("NOW()") },
  });

  pgm.createIndex("messages", "conversation_id");
  pgm.createIndex("messages", ["conversation_id", "created_at"]);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropTable("messages");
  pgm.dropTable("conversations");
  pgm.dropType("message_role");
};
