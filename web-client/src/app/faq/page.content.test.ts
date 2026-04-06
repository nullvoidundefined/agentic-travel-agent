import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Content assertions for the FAQ page.
 *
 * These tests lock in copy changes from the 2026-04-06 audit. Like
 * page.content.test.ts, this is a source-level regression guard rather
 * than a full RTL mount.
 */

const faqPath = resolve(__dirname, 'page.tsx');
const faqSource = readFileSync(faqPath, 'utf-8');

describe('FAQ page content', () => {
  it('data source answer names SerpApi and Google Flights', () => {
    expect(faqSource).toContain('SerpApi');
    expect(faqSource).toContain('Google Flights');
  });

  it('data source answer does not falsely claim Amadeus as the provider', () => {
    expect(faqSource).not.toContain('Amadeus API');
  });

  it('data sharing answer does not route queries to Amadeus', () => {
    expect(faqSource).not.toMatch(/queries to Amadeus/);
  });
});
