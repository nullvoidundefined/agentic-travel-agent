/**
 * Create trip_hotels table for storing hotel search results and selections.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable("trip_hotels", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    trip_id: {
      type: "uuid",
      notNull: true,
      references: "trips",
      onDelete: "CASCADE",
    },
    amadeus_hotel_id: { type: "text" },
    name: { type: "text" },
    address: { type: "text" },
    city: { type: "text" },
    star_rating: { type: "integer" },
    price_per_night: { type: "numeric(10,2)" },
    total_price: { type: "numeric(10,2)" },
    currency: { type: "text", default: pgm.func("'USD'") },
    check_in: { type: "date" },
    check_out: { type: "date" },
    data_json: { type: "jsonb" },
    selected: { type: "boolean", default: false },
    created_at: { type: "timestamptz", default: pgm.func("NOW()") },
  });

  pgm.createIndex("trip_hotels", "trip_id");
  pgm.createIndex("trip_hotels", ["trip_id", "selected"]);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropTable("trip_hotels");
};
