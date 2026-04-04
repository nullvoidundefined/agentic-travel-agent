import { describe, expect, it } from "vitest";

import {
  CURRENT_PREFERENCES_VERSION,
  DEFAULT_PREFERENCES,
  type UserPreferences,
  WIZARD_STEPS,
  normalizePreferences,
} from "./userPreferences.js";

describe("userPreferences schema", () => {
  describe("normalizePreferences", () => {
    it("returns defaults for null input", () => {
      const result = normalizePreferences(null);
      expect(result.schema_version).toBe(CURRENT_PREFERENCES_VERSION);
      expect(result.accommodation).toBeNull();
      expect(result.travel_pace).toBeNull();
      expect(result.dietary).toEqual([]);
      expect(result.dining_style).toBeNull();
      expect(result.activities).toEqual([]);
      expect(result.travel_party).toBeNull();
      expect(result.budget_comfort).toBeNull();
      expect(result.completed_steps).toEqual([]);
    });

    it("returns defaults for undefined input", () => {
      const result = normalizePreferences(undefined);
      expect(result.schema_version).toBe(CURRENT_PREFERENCES_VERSION);
    });

    it("returns defaults for empty object", () => {
      const result = normalizePreferences({});
      expect(result.schema_version).toBe(CURRENT_PREFERENCES_VERSION);
      expect(result.accommodation).toBeNull();
    });

    it("preserves valid v1 data", () => {
      const input: UserPreferences = {
        schema_version: 1,
        accommodation: "upscale",
        travel_pace: "relaxed",
        dietary: ["vegan"],
        dining_style: "fine-dining",
        activities: ["history-culture", "wellness-spa"],
        travel_party: "romantic-partner",
        budget_comfort: "comfort-first",
        completed_steps: ["accommodation", "travel_pace", "dining"],
        lgbtq_safety: false,
        gender: null,
      };
      const result = normalizePreferences(input);
      expect(result).toEqual(input);
    });

    it("fills missing fields with defaults", () => {
      const input = { version: 1, accommodation: "budget" };
      const result = normalizePreferences(input);
      expect(result.accommodation).toBe("budget");
      expect(result.travel_pace).toBeNull();
      expect(result.dietary).toEqual([]);
      expect(result.activities).toEqual([]);
      expect(result.completed_steps).toEqual([]);
    });

    it("upgrades v0 data (legacy format with intensity/social)", () => {
      const legacy = {
        dietary: ["vegetarian"],
        intensity: "active",
        social: "couple",
      };
      const result = normalizePreferences(legacy);
      expect(result.schema_version).toBe(1);
      expect(result.dietary).toEqual(["vegetarian"]);
      expect(result.travel_pace).toBe("active");
      expect(result.travel_party).toBe("romantic-partner");
      expect(result.accommodation).toBeNull();
    });

    it("maps legacy social values correctly", () => {
      expect(normalizePreferences({ social: "couple" }).travel_party).toBe(
        "romantic-partner",
      );
      expect(normalizePreferences({ social: "group" }).travel_party).toBe(
        "friends",
      );
      expect(normalizePreferences({ social: "family" }).travel_party).toBe(
        "family-with-kids",
      );
      expect(normalizePreferences({ social: "solo" }).travel_party).toBe(
        "solo",
      );
    });

    it("should normalize v1 data with lgbtq_safety and gender fields", () => {
      const result = normalizePreferences({
        version: 1,
        accommodation: "budget",
        lgbtq_safety: true,
        gender: "woman",
      });
      expect(result.lgbtq_safety).toBe(true);
      expect(result.gender).toBe("woman");
    });

    it("should default lgbtq_safety to false and gender to null", () => {
      const result = normalizePreferences({ version: 1 });
      expect(result.lgbtq_safety).toBe(false);
      expect(result.gender).toBeNull();
    });

    it("should include lgbtq_safety and gender in DEFAULT_PREFERENCES", () => {
      expect(DEFAULT_PREFERENCES.lgbtq_safety).toBe(false);
      expect(DEFAULT_PREFERENCES.gender).toBeNull();
    });
    it("stamps schema_version on DEFAULT_PREFERENCES", () => {
      expect(DEFAULT_PREFERENCES.schema_version).toBe(
        CURRENT_PREFERENCES_VERSION,
      );
    });

    it("recognizes old version field as v1", () => {
      const result = normalizePreferences({
        version: 1,
        accommodation: "budget",
      });
      expect(result.schema_version).toBe(CURRENT_PREFERENCES_VERSION);
    });

    it("preserves schema_version on current data", () => {
      const result = normalizePreferences({
        schema_version: 1,
        accommodation: "upscale",
      });
      expect(result.schema_version).toBe(1);
    });

    it("stamps schema_version on v0 migration", () => {
      const result = normalizePreferences({
        dietary: ["vegan"],
        intensity: "relaxed",
      });
      expect(result.schema_version).toBe(CURRENT_PREFERENCES_VERSION);
    });

    it("returns defaults with schema_version for null", () => {
      expect(normalizePreferences(null).schema_version).toBe(
        CURRENT_PREFERENCES_VERSION,
      );
    });
  });

  describe("WIZARD_STEPS", () => {
    it("has 6 steps", () => {
      expect(WIZARD_STEPS).toHaveLength(6);
    });

    it("each step has id and label", () => {
      for (const step of WIZARD_STEPS) {
        expect(step.id).toBeDefined();
        expect(step.label).toBeDefined();
      }
    });
  });
});
