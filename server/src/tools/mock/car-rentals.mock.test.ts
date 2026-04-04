import { describe, expect, it } from 'vitest';

import type { CarRentalInput } from '../car-rentals.tool.js';
import { generateMockCarRentals } from './car-rentals.mock.js';

describe('generateMockCarRentals', () => {
  const input: CarRentalInput = {
    pickup_location: 'Tokyo',
    pickup_date: '2026-05-01',
    dropoff_date: '2026-05-08',
  };

  it('returns an object with a rentals array', () => {
    const result = generateMockCarRentals(input);
    expect(result).toHaveProperty('rentals');
    expect(result.rentals).toBeInstanceOf(Array);
    expect(result.rentals.length).toBeGreaterThan(0);
  });

  it('each rental has required CarRentalResult fields', () => {
    const { rentals } = generateMockCarRentals(input);
    for (const r of rentals) {
      expect(r).toHaveProperty('provider');
      expect(r).toHaveProperty('car_name');
      expect(r).toHaveProperty('car_type');
      expect(r).toHaveProperty('price_per_day');
      expect(r).toHaveProperty('total_price');
      expect(r).toHaveProperty('currency', 'USD');
      expect(r).toHaveProperty('pickup_location', 'Tokyo');
      expect(r).toHaveProperty('pickup_date', '2026-05-01');
      expect(r).toHaveProperty('dropoff_date', '2026-05-08');
    }
  });

  it('uses pickup_location as dropoff when dropoff not provided', () => {
    const { rentals } = generateMockCarRentals(input);
    for (const r of rentals) {
      expect(r.dropoff_location).toBe('Tokyo');
    }
  });

  it('uses explicit dropoff_location when provided', () => {
    const { rentals } = generateMockCarRentals({
      ...input,
      dropoff_location: 'Osaka',
    });
    for (const r of rentals) {
      expect(r.dropoff_location).toBe('Osaka');
    }
  });
});
