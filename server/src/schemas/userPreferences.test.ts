import { describe, expect, it } from 'vitest';

import {
  CURRENT_PREFERENCES_VERSION,
  DEFAULT_PREFERENCES,
  type UserPreferences,
  WIZARD_STEPS,
  normalizePreferences,
} from './userPreferences.js';

describe('userPreferences schema', () => {
  describe('normalizePreferences', () => {
    it('returns defaults for null input', () => {
      const result = normalizePreferences(null);
      expect(result.version).toBe(CURRENT_PREFERENCES_VERSION);
      expect(result.accommodation).toBeNull();
      expect(result.travel_pace).toBeNull();
      expect(result.dietary).toEqual([]);
      expect(result.dining_style).toBeNull();
      expect(result.activities).toEqual([]);
      expect(result.travel_party).toBeNull();
      expect(result.budget_comfort).toBeNull();
      expect(result.completed_steps).toEqual([]);
    });

    it('returns defaults for undefined input', () => {
      const result = normalizePreferences(undefined);
      expect(result.version).toBe(CURRENT_PREFERENCES_VERSION);
    });

    it('returns defaults for empty object', () => {
      const result = normalizePreferences({});
      expect(result.version).toBe(CURRENT_PREFERENCES_VERSION);
      expect(result.accommodation).toBeNull();
    });

    it('preserves valid v1 data', () => {
      const input: UserPreferences = {
        version: 1,
        accommodation: 'upscale',
        travel_pace: 'relaxed',
        dietary: ['vegan'],
        dining_style: 'fine-dining',
        activities: ['history-culture', 'wellness-spa'],
        travel_party: 'romantic-partner',
        budget_comfort: 'comfort-first',
        completed_steps: ['accommodation', 'travel_pace', 'dining'],
      };
      const result = normalizePreferences(input);
      expect(result).toEqual(input);
    });

    it('fills missing fields with defaults', () => {
      const input = { version: 1, accommodation: 'budget' };
      const result = normalizePreferences(input);
      expect(result.accommodation).toBe('budget');
      expect(result.travel_pace).toBeNull();
      expect(result.dietary).toEqual([]);
      expect(result.activities).toEqual([]);
      expect(result.completed_steps).toEqual([]);
    });

    it('upgrades v0 data (legacy format with intensity/social)', () => {
      const legacy = {
        dietary: ['vegetarian'],
        intensity: 'active',
        social: 'couple',
      };
      const result = normalizePreferences(legacy);
      expect(result.version).toBe(1);
      expect(result.dietary).toEqual(['vegetarian']);
      expect(result.travel_pace).toBe('active');
      expect(result.travel_party).toBe('romantic-partner');
      expect(result.accommodation).toBeNull();
    });

    it('maps legacy social values correctly', () => {
      expect(normalizePreferences({ social: 'couple' }).travel_party).toBe(
        'romantic-partner',
      );
      expect(normalizePreferences({ social: 'group' }).travel_party).toBe(
        'friends',
      );
      expect(normalizePreferences({ social: 'family' }).travel_party).toBe(
        'family-with-kids',
      );
      expect(normalizePreferences({ social: 'solo' }).travel_party).toBe(
        'solo',
      );
    });
  });

  describe('WIZARD_STEPS', () => {
    it('has 6 steps', () => {
      expect(WIZARD_STEPS).toHaveLength(6);
    });

    it('each step has id and label', () => {
      for (const step of WIZARD_STEPS) {
        expect(step.id).toBeDefined();
        expect(step.label).toBeDefined();
      }
    });
  });
});
