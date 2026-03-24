import { describe, expect, it } from "vitest";

import { buildSystemPrompt } from "app/prompts/system-prompt.js";
import type { TripContext } from "app/prompts/trip-context.js";

describe("system-prompt", () => {
  describe("buildSystemPrompt", () => {
    it("includes the agent persona", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("travel");
      expect(prompt).toContain("planning assistant");
    });

    it("includes tool usage guidelines", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("search_flights");
      expect(prompt).toContain("calculate_remaining_budget");
      expect(prompt).toContain("IATA");
    });

    it("instructs to search flights first", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("flights first");
    });

    it("includes budget awareness instructions", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("budget");
    });

    it("includes empty result handling guidance", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toMatch(/empty|no results|couldn't find/i);
    });

    it("includes the 15-call safety limit note", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("15");
    });

    it("injects trip context when provided", () => {
      const ctx: TripContext = {
        destination: "Barcelona",
        origin: "SFO",
        departure_date: "2026-07-01",
        return_date: "2026-07-06",
        budget_total: 3000,
        budget_currency: "USD",
        travelers: 2,
        preferences: { style: "mid-range", pace: "moderate", interests: ["food", "history"] },
        selected_flights: [
          {
            airline: "United",
            flight_number: "UA123",
            price: 450,
            departure_time: "2026-07-01T08:00:00Z",
            arrival_time: "2026-07-01T20:00:00Z",
          },
        ],
        selected_hotels: [],
        selected_experiences: [],
        total_spent: 450,
      };

      const prompt = buildSystemPrompt(ctx);
      expect(prompt).toContain("Barcelona");
      expect(prompt).toContain("SFO");
      expect(prompt).toContain("3000");
      expect(prompt).toContain("UA123");
      expect(prompt).toContain("450");
    });

    it("works without trip context", () => {
      const prompt = buildSystemPrompt();
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(100);
    });

    it("includes topic guardrail restricting to travel-related topics", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toMatch(/off.topic|unrelated|only.*travel|decline|politely/i);
    });

    it("topic guardrail mentions allowed topics", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("travel");
      expect(prompt).toMatch(/trip|itinerar/i);
      expect(prompt).toMatch(/user|preference/i);
    });
  });
});
