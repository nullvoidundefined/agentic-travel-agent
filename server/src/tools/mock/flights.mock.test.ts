import { describe, expect, it } from 'vitest';

import type { FlightSearchInput } from '../flights.tool.js';
import { generateMockFlights } from './flights.mock.js';

describe('generateMockFlights', () => {
  const input: FlightSearchInput = {
    origin: 'SFO',
    destination: 'BCN',
    departure_date: '2026-07-01',
    passengers: 1,
    cabin_class: 'BUSINESS',
  };

  it('returns an array of FlightResult objects', () => {
    const results = generateMockFlights(input);
    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBeGreaterThan(0);
  });

  it('each result has required FlightResult fields', () => {
    const results = generateMockFlights(input);
    for (const r of results) {
      expect(r).toHaveProperty('offer_id');
      expect(r).toHaveProperty('origin', 'SFO');
      expect(r).toHaveProperty('destination', 'BCN');
      expect(r).toHaveProperty('departure_time');
      expect(r).toHaveProperty('arrival_time');
      expect(r).toHaveProperty('airline');
      expect(r).toHaveProperty('price');
      expect(r).toHaveProperty('currency', 'USD');
      expect(r).toHaveProperty('segments');
      expect(r.segments.length).toBeGreaterThan(0);
    }
  });

  it('uses input cabin_class when provided', () => {
    const results = generateMockFlights(input);
    for (const r of results) {
      expect(r.cabin_class).toBe('BUSINESS');
    }
  });

  it('defaults cabin_class to ECONOMY when not provided', () => {
    const results = generateMockFlights({
      origin: 'SFO',
      destination: 'BCN',
      departure_date: '2026-07-01',
      passengers: 1,
    });
    for (const r of results) {
      expect(r.cabin_class).toBe('ECONOMY');
    }
  });
});
