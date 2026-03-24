/**
 * Create trips table for storing user trip plans.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createType("trip_status", ["planning", "saved", "archived"]);

  pgm.createTable("trips", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },
    destination: { type: "text", notNull: true },
    origin: { type: "text" },
    departure_date: { type: "date" },
    return_date: { type: "date" },
    budget_total: { type: "numeric(10,2)" },
    budget_currency: { type: "text", default: pgm.func("'USD'") },
    travelers: { type: "integer", default: 1 },
    preferences: { type: "jsonb", default: pgm.func("'{}'::jsonb") },
    status: { type: "trip_status", default: pgm.func("'planning'") },
    created_at: { type: "timestamptz", default: pgm.func("NOW()") },
    updated_at: { type: "timestamptz", default: pgm.func("NOW()") },
  });

  pgm.createIndex("trips", "user_id");
  pgm.sql(`
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON trips
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.sql("DROP TRIGGER IF EXISTS set_updated_at ON trips;");
  pgm.dropTable("trips");
  pgm.dropType("trip_status");
};
