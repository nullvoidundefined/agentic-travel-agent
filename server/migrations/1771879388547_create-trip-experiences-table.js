/**
 * Create trip_experiences table for storing experience/activity search results.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable("trip_experiences", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    trip_id: {
      type: "uuid",
      notNull: true,
      references: "trips",
      onDelete: "CASCADE",
    },
    google_place_id: { type: "text" },
    name: { type: "text" },
    category: { type: "text" },
    address: { type: "text" },
    rating: { type: "numeric(2,1)" },
    price_level: { type: "integer" },
    estimated_cost: { type: "numeric(10,2)" },
    data_json: { type: "jsonb" },
    selected: { type: "boolean", default: false },
    created_at: { type: "timestamptz", default: pgm.func("NOW()") },
  });

  pgm.createIndex("trip_experiences", "trip_id");
  pgm.createIndex("trip_experiences", ["trip_id", "selected"]);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropTable("trip_experiences");
};
