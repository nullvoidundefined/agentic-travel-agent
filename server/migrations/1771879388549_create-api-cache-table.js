/**
 * Create api_cache table for persistent caching of external API responses.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createType("api_provider", ["amadeus", "google_places"]);

  pgm.createTable("api_cache", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    cache_key: { type: "text", notNull: true, unique: true },
    provider: { type: "api_provider", notNull: true },
    endpoint: { type: "text", notNull: true },
    request_hash: { type: "text", notNull: true },
    response_json: { type: "jsonb", notNull: true },
    expires_at: { type: "timestamptz", notNull: true },
    created_at: { type: "timestamptz", default: pgm.func("NOW()") },
  });

  pgm.createIndex("api_cache", "cache_key");
  pgm.createIndex("api_cache", "expires_at");
  pgm.createIndex("api_cache", ["provider", "request_hash"]);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropTable("api_cache");
  pgm.dropType("api_provider");
};
