import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * DES-03 / UX-12 (2026-04-06 audit): globals.scss must contain a
 * prefers-reduced-motion media query that neutralizes animations
 * and transitions globally. Users with vestibular disorders get
 * near-instant motion instead of multi-second keyframe animations.
 */

const globalsPath = resolve(__dirname, 'globals.scss');
const globalsSource = readFileSync(globalsPath, 'utf-8');

describe('globals.scss accessibility', () => {
  it('contains a prefers-reduced-motion media query', () => {
    expect(globalsSource).toMatch(/prefers-reduced-motion/);
  });

  it('collapses animation-duration under reduced motion', () => {
    expect(globalsSource).toMatch(/animation-duration:\s*0\.01ms/);
  });

  it('collapses transition-duration under reduced motion', () => {
    expect(globalsSource).toMatch(/transition-duration:\s*0\.01ms/);
  });

  it('uses universal selector so no keyframe escapes the guard', () => {
    expect(globalsSource).toMatch(/\*,\s*\n?\s*\*::before/);
  });
});

describe('globals.scss type scale tokens (DES-01)', () => {
  it('defines --text-base token', () => {
    expect(globalsSource).toMatch(/--text-base:/);
  });

  it('defines --text-lg / --text-xl / --text-2xl tokens', () => {
    expect(globalsSource).toMatch(/--text-lg:/);
    expect(globalsSource).toMatch(/--text-xl:/);
    expect(globalsSource).toMatch(/--text-2xl:/);
  });

  it('defines --text-3xl and --text-4xl display sizes', () => {
    expect(globalsSource).toMatch(/--text-3xl:/);
    expect(globalsSource).toMatch(/--text-4xl:/);
  });
});
