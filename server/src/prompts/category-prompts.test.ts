import { describe, it, expect } from 'vitest';
import { getCategoryPrompt, getPhasePrompt } from './category-prompts.js';
import type { CategoryName, CategoryStatus } from './booking-steps.js';

describe('category-prompts', () => {
  const categories: CategoryName[] = ['flights', 'hotels', 'car_rental', 'experiences'];
  const statuses: CategoryStatus[] = ['idle', 'asking', 'presented'];

  for (const cat of categories) {
    for (const status of statuses) {
      it(`returns a prompt for ${cat}/${status}`, () => {
        const prompt = getCategoryPrompt(cat, status);
        expect(prompt.length).toBeGreaterThan(20);
        expect(prompt).toContain('format_response');
      });
    }
  }

  it('flights/idle mentions flying and driving', () => {
    const prompt = getCategoryPrompt('flights', 'idle');
    expect(prompt).toContain('flying');
    expect(prompt).toContain('driving');
  });

  it('flights/asking mentions time preference', () => {
    const prompt = getCategoryPrompt('flights', 'asking');
    expect(prompt).toMatch(/time|morning|afternoon|evening/i);
  });

  it('hotels/asking mentions hotel', () => {
    const prompt = getCategoryPrompt('hotels', 'asking');
    expect(prompt).toMatch(/hotel/i);
  });

  it('car_rental/asking mentions rental car', () => {
    const prompt = getCategoryPrompt('car_rental', 'asking');
    expect(prompt).toMatch(/rental car/i);
  });

  it('experiences/asking mentions preferences', () => {
    const prompt = getCategoryPrompt('experiences', 'asking');
    expect(prompt).toMatch(/preferences/i);
  });

  it('all presented prompts say not to describe results', () => {
    for (const cat of categories) {
      const prompt = getCategoryPrompt(cat, 'presented');
      expect(prompt).toMatch(/do not|don't|never/i);
    }
  });

  it('COLLECT_DETAILS phase prompt mentions form', () => {
    expect(getPhasePrompt('COLLECT_DETAILS')).toMatch(/form/i);
  });

  it('CONFIRM phase prompt mentions confirm or book', () => {
    expect(getPhasePrompt('CONFIRM')).toMatch(/confirm|book/i);
  });

  it('all prompts include brevity rule', () => {
    for (const cat of categories) {
      for (const status of statuses) {
        expect(getCategoryPrompt(cat, status)).toMatch(/1-2 sentences/i);
      }
    }
  });
});
