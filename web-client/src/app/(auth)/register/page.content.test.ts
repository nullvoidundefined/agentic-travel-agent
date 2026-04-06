import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Content assertions for the register page. Guards against the
 * pre-audit dead-link pattern where Terms of Service and Privacy
 * Policy links pointed to /faq despite no such documents existing.
 */

const registerPath = resolve(__dirname, 'page.tsx');
const registerSource = readFileSync(registerPath, 'utf-8');

describe('register page content', () => {
  it('does not promise agreement to a Terms of Service', () => {
    expect(registerSource).not.toMatch(/agree.*Terms of Service/i);
  });

  it('does not promise agreement to a Privacy Policy', () => {
    expect(registerSource).not.toMatch(/agree.*Privacy Policy/i);
  });

  it('does not link the strings "Terms of Service" or "Privacy Policy" anywhere', () => {
    expect(registerSource).not.toContain('Terms of Service');
    expect(registerSource).not.toContain('Privacy Policy');
  });
});
