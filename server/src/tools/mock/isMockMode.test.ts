import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isMockMode } from './isMockMode.js';

describe('isMockMode', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.EVAL_MOCK_SEARCH;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.EVAL_MOCK_SEARCH;
    } else {
      process.env.EVAL_MOCK_SEARCH = originalEnv;
    }
  });

  it('returns true when EVAL_MOCK_SEARCH is "true"', () => {
    process.env.EVAL_MOCK_SEARCH = 'true';
    expect(isMockMode()).toBe(true);
  });

  it('returns false when EVAL_MOCK_SEARCH is not set', () => {
    delete process.env.EVAL_MOCK_SEARCH;
    expect(isMockMode()).toBe(false);
  });

  it('returns false when EVAL_MOCK_SEARCH is "false"', () => {
    process.env.EVAL_MOCK_SEARCH = 'false';
    expect(isMockMode()).toBe(false);
  });

  it('returns false when EVAL_MOCK_SEARCH is empty string', () => {
    process.env.EVAL_MOCK_SEARCH = '';
    expect(isMockMode()).toBe(false);
  });
});
