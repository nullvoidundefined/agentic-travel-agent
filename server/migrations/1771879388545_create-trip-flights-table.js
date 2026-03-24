/**
 * Create trip_flights table for storing flight search results and selections.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable("trip_flights", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    trip_id: {
      type: "uuid",
      notNull: true,
      references: "trips",
      onDelete: "CASCADE",
    },
    amadeus_offer_id: { type: "text" },
    origin: { type: "text", notNull: true },
    destination: { type: "text", notNull: true },
    departure_time: { type: "timestamptz" },
    arrival_time: { type: "timestamptz" },
    airline: { type: "text" },
    flight_number: { type: "text" },
    price: { type: "numeric(10,2)" },
    currency: { type: "text", default: pgm.func("'USD'") },
    cabin_class: { type: "text" },
    data_json: { type: "jsonb" },
    selected: { type: "boolean", default: false },
    created_at: { type: "timestamptz", default: pgm.func("NOW()") },
  });

  pgm.createIndex("trip_flights", "trip_id");
  pgm.createIndex("trip_flights", ["trip_id", "selected"]);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropTable("trip_flights");
};
