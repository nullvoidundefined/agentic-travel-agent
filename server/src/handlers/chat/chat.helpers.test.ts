import type { TripWithDetails } from "app/schemas/trips.js";
import { describe, expect, it } from "vitest";

import {
  buildClaudeMessages,
  buildMissingFieldsForm,
  buildTripContext,
  computeFlowPosition,
  toFlowInput,
} from "./chat.helpers.js";

const baseTripDetails: TripWithDetails = {
  id: "trip-1",
  user_id: "user-1",
  destination: "Barcelona",
  origin: "JFK",
  departure_date: "2026-07-01",
  return_date: "2026-07-06",
  budget_total: 3000,
  budget_currency: "USD",
  travelers: 2,
  preferences: {},
  status: "planning",
  transport_mode: "flying",
  trip_type: "round_trip",
  created_at: new Date(),
  updated_at: new Date(),
  flights: [],
  hotels: [],
  car_rentals: [],
  experiences: [],
};

describe("chat.helpers", () => {
  describe("toFlowInput", () => {
    it("maps TripWithDetails to TripState correctly", () => {
      const result = toFlowInput(baseTripDetails);
      expect(result.destination).toBe("Barcelona");
      expect(result.origin).toBe("JFK");
      expect(result.status).toBe("planning");
      expect(result.flights).toEqual([]);
    });

    it("maps null optional fields", () => {
      const trip = { ...baseTripDetails, origin: null, transport_mode: null };
      const result = toFlowInput(trip);
      expect(result.origin).toBeNull();
      expect(result.transport_mode).toBeNull();
    });

    it("extracts only ids from sub-arrays", () => {
      const trip = {
        ...baseTripDetails,
        flights: [{ id: "f1" }] as TripWithDetails["flights"],
      };
      const result = toFlowInput(trip);
      expect(result.flights).toEqual([{ id: "f1" }]);
    });
  });

  describe("computeFlowPosition", () => {
    it("returns PLANNING for complete trip", () => {
      expect(computeFlowPosition(baseTripDetails).phase).toBe("PLANNING");
    });

    it("returns COLLECT_DETAILS when origin is missing", () => {
      const trip = { ...baseTripDetails, origin: null };
      expect(computeFlowPosition(trip).phase).toBe("COLLECT_DETAILS");
    });

    it("returns COMPLETE when status is saved", () => {
      const trip = { ...baseTripDetails, status: "saved" as const };
      expect(computeFlowPosition(trip).phase).toBe("COMPLETE");
    });
  });

  describe("buildClaudeMessages", () => {
    it("adds current message and filters to user/assistant roles", () => {
      const history = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
        { role: "tool", content: "tool result" },
      ];
      const result = buildClaudeMessages(history, "New message");
      expect(result).toHaveLength(3); // 2 from history + 1 current
      expect(result[result.length - 1]).toEqual({
        role: "user",
        content: "New message",
      });
    });

    it("truncates to first + last 20 messages", () => {
      const history = Array.from({ length: 25 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i}`,
      }));
      const result = buildClaudeMessages(history, "Latest");
      // 25 + 1 = 26, truncated to first + last 20 = 21
      expect(result).toHaveLength(21);
      expect(result[0]!.content).toBe("Message 0");
      expect(result[result.length - 1]!.content).toBe("Latest");
    });

    it("handles null content as empty string", () => {
      const history = [{ role: "user", content: null }];
      const result = buildClaudeMessages(history, "Hi");
      expect(result[0]!.content).toBe("");
    });
  });

  describe("buildTripContext", () => {
    it("includes user preferences when provided", () => {
      const prefs = {
        schema_version: 1,
        accommodation: "upscale" as const,
        travel_pace: "relaxed" as const,
        dietary: ["vegan"],
        dining_style: "fine-dining" as const,
        activities: ["history-culture"],
        travel_party: "romantic-partner" as const,
        budget_comfort: "comfort-first" as const,
        completed_steps: [],
        lgbtq_safety: false,
        gender: null,
      };
      const ctx = buildTripContext(baseTripDetails, prefs);
      expect(ctx.user_preferences?.accommodation).toBe("upscale");
    });

    it("omits user_preferences when null", () => {
      const ctx = buildTripContext(baseTripDetails, null);
      expect(ctx.user_preferences).toBeUndefined();
    });

    it("calculates total_spent from all selections", () => {
      const trip = {
        ...baseTripDetails,
        flights: [{ price: 400 }] as TripWithDetails["flights"],
        hotels: [{ total_price: 600 }] as TripWithDetails["hotels"],
        experiences: [{ estimated_cost: 50 }] as TripWithDetails["experiences"],
      };
      const ctx = buildTripContext(trip, null);
      expect(ctx.total_spent).toBe(1050);
    });
  });

  describe("buildMissingFieldsForm", () => {
    it("returns null when all fields are present", () => {
      expect(buildMissingFieldsForm(baseTripDetails)).toBeNull();
    });

    it("lists missing origin field", () => {
      const trip = { ...baseTripDetails, origin: null };
      const form = buildMissingFieldsForm(trip);
      expect(form).not.toBeNull();
      expect(
        (form as { fields: Array<{ name: string }> }).fields.find(
          (f) => f.name === "origin",
        ),
      ).toBeDefined();
    });

    it("skips return_date for one-way trips", () => {
      const trip = {
        ...baseTripDetails,
        return_date: null,
        trip_type: "one_way" as const,
      };
      const form = buildMissingFieldsForm(trip);
      // return_date should NOT be in missing fields for one-way
      if (form) {
        expect(
          (form as { fields: Array<{ name: string }> }).fields.find(
            (f) => f.name === "return_date",
          ),
        ).toBeUndefined();
      }
    });

    it("includes destination for placeholder trips", () => {
      const trip = { ...baseTripDetails, destination: "Planning..." };
      const form = buildMissingFieldsForm(trip);
      expect(form).not.toBeNull();
      expect(
        (form as { fields: Array<{ name: string }> }).fields.find(
          (f) => f.name === "destination",
        ),
      ).toBeDefined();
    });
  });
});
