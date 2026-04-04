import { describe, expect, it } from 'vitest';

import type { ExperienceSearchInput } from '../experiences.tool.js';
import { generateMockExperiences } from './experiences.mock.js';

describe('generateMockExperiences', () => {
  const input: ExperienceSearchInput = {
    location: 'Barcelona',
    categories: ['tours', 'museums'],
  };

  it('returns an array of ExperienceResult objects', () => {
    const results = generateMockExperiences(input);
    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBeGreaterThan(0);
  });

  it('each result has required ExperienceResult fields', () => {
    const results = generateMockExperiences(input);
    for (const r of results) {
      expect(r).toHaveProperty('place_id');
      expect(r).toHaveProperty('name');
      expect(r).toHaveProperty('address', 'Barcelona');
      expect(r).toHaveProperty('rating');
      expect(r).toHaveProperty('price_level');
      expect(r).toHaveProperty('estimated_cost');
      expect(r).toHaveProperty('category');
    }
  });

  it('includes location name in experience names', () => {
    const results = generateMockExperiences(input);
    for (const r of results) {
      expect(r.name).toContain('Barcelona');
    }
  });
});
