/** @type {import("node-pg-migrate").MigrationBuilder} */
export const up = (pgm) => {
  pgm.createType("preference_intensity", ["relaxed", "moderate", "active"]);
  pgm.createType("preference_social", ["solo", "couple", "group", "family"]);

  pgm.createTable("user_preferences", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    user_id: {
      type: "uuid",
      notNull: true,
      unique: true,
      references: "users",
      onDelete: "CASCADE",
    },
    dietary: {
      type: "text[]",
      notNull: true,
      default: pgm.func("ARRAY[]::text[]"),
    },
    intensity: {
      type: "preference_intensity",
      notNull: true,
      default: "moderate",
    },
    social: {
      type: "preference_social",
      notNull: true,
      default: "couple",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  pgm.createIndex("user_preferences", "user_id");

  // Reuse the existing set_updated_at trigger function from the users migration
  pgm.sql(`
    CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropTable("user_preferences");
  pgm.dropType("preference_social");
  pgm.dropType("preference_intensity");
};
