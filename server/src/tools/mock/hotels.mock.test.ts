import { describe, expect, it } from 'vitest';

import type { HotelSearchInput } from '../hotels.tool.js';
import { generateMockHotels } from './hotels.mock.js';

describe('generateMockHotels', () => {
  const input: HotelSearchInput = {
    city: 'Barcelona',
    check_in: '2026-07-01',
    check_out: '2026-07-06',
    guests: 2,
  };

  it('returns an array of HotelResult objects', () => {
    const results = generateMockHotels(input);
    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBeGreaterThan(0);
  });

  it('each result has required HotelResult fields', () => {
    const results = generateMockHotels(input);
    for (const r of results) {
      expect(r).toHaveProperty('hotel_id');
      expect(r).toHaveProperty('offer_id');
      expect(r).toHaveProperty('name');
      expect(r).toHaveProperty('city', 'Barcelona');
      expect(r).toHaveProperty('star_rating');
      expect(r).toHaveProperty('price_per_night');
      expect(r).toHaveProperty('total_price');
      expect(r).toHaveProperty('currency', 'USD');
      expect(r).toHaveProperty('check_in', '2026-07-01');
      expect(r).toHaveProperty('check_out', '2026-07-06');
    }
  });

  it('includes a range of star ratings', () => {
    const results = generateMockHotels(input);
    const ratings = results.map((r) => r.star_rating);
    expect(Math.min(...ratings)).toBeLessThanOrEqual(2);
    expect(Math.max(...ratings)).toBeGreaterThanOrEqual(4);
  });
});
