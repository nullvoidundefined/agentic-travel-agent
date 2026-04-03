import { buildSystemPrompt } from 'app/prompts/system-prompt.js';
import type { TripContext } from 'app/prompts/trip-context.js';
import type { FlowPosition } from 'app/prompts/booking-steps.js';
import { describe, expect, it } from 'vitest';

const fullCtx: TripContext = {
  destination: 'Barcelona',
  origin: 'SFO',
  departure_date: '2026-07-01',
  return_date: '2026-07-06',
  budget_total: 3000,
  budget_currency: 'USD',
  travelers: 2,
  transport_mode: 'flying',
  preferences: {
    style: 'mid-range',
    pace: 'moderate',
    interests: ['food', 'history'],
  },
  selected_flights: [
    {
      airline: 'United',
      flight_number: 'UA123',
      price: 450,
      departure_time: '2026-07-01T08:00:00Z',
      arrival_time: '2026-07-01T20:00:00Z',
    },
  ],
  selected_car_rentals: [],
  selected_hotels: [],
  selected_experiences: [],
  total_spent: 450,
};

describe('system-prompt', () => {
  describe('buildSystemPrompt', () => {
    it('defaults to COLLECT_DETAILS when no position provided', () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain('form');
    });

    it('uses COLLECT_DETAILS phase prompt when phase is COLLECT_DETAILS', () => {
      const pos: FlowPosition = { phase: 'COLLECT_DETAILS' };
      const prompt = buildSystemPrompt(undefined, pos);
      expect(prompt).toContain('form');
    });

    it('uses category prompt for flights/idle which contains flying/driving', () => {
      const pos: FlowPosition = { phase: 'CATEGORY', category: 'flights', status: 'idle' };
      const prompt = buildSystemPrompt(undefined, pos);
      expect(prompt.toLowerCase()).toMatch(/flying|driving/);
    });

    it('uses CONFIRM phase prompt', () => {
      const pos: FlowPosition = { phase: 'CONFIRM' };
      const prompt = buildSystemPrompt(undefined, pos);
      expect(prompt.toLowerCase()).toContain('book');
    });

    it('uses COMPLETE phase prompt', () => {
      const pos: FlowPosition = { phase: 'COMPLETE' };
      const prompt = buildSystemPrompt(undefined, pos);
      expect(prompt.toLowerCase()).toContain('booked');
    });

    it("includes today's date", () => {
      const prompt = buildSystemPrompt();
      const today = new Date().toISOString().split('T')[0];
      expect(prompt).toContain(today!);
    });

    it('includes trip context when provided', () => {
      const prompt = buildSystemPrompt(fullCtx);
      expect(prompt).toContain('Barcelona');
      expect(prompt).toContain('SFO');
      expect(prompt).toContain('3000');
      expect(prompt).toContain('UA123');
      expect(prompt).toContain('450');
    });

    it('works without trip context', () => {
      const prompt = buildSystemPrompt();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(100);
    });

    it('includes format_response requirement', () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain('format_response');
    });

    it('includes brevity rule (1-2 sentences)', () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toMatch(/1-2 sentences/i);
    });
  });
});
