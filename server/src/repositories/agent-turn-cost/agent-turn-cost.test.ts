import {
  SONNET_4_INPUT_USD_PER_MTOK,
  SONNET_4_OUTPUT_USD_PER_MTOK,
  estimateCostUsd,
} from 'app/repositories/agent-turn-cost/agent-turn-cost.js';
import { describe, expect, it } from 'vitest';

/**
 * FIN-04: agent_turn_cost pricing and estimate calculation.
 */

describe('estimateCostUsd', () => {
  it('returns 0 for zero tokens', () => {
    expect(estimateCostUsd(0, 0)).toBe(0);
  });

  it('charges $3 per million input tokens (Sonnet 4 pricing)', () => {
    expect(estimateCostUsd(1_000_000, 0)).toBe(3);
  });

  it('charges $15 per million output tokens (Sonnet 4 pricing)', () => {
    expect(estimateCostUsd(0, 1_000_000)).toBe(15);
  });

  it('sums input + output correctly', () => {
    // 500k input at $3/MTok = $1.50
    // 100k output at $15/MTok = $1.50
    // total = $3.00
    expect(estimateCostUsd(500_000, 100_000)).toBe(3);
  });

  it('rounds to 6 decimal places to match numeric(10,6) column', () => {
    // 1 input token = 3 / 1M = 0.000003 USD, which fits exactly
    expect(estimateCostUsd(1, 0)).toBe(0.000003);
  });

  it('handles typical agent turn (~40k in, ~8k out) accurately', () => {
    // 40k * $3/M = $0.12
    // 8k * $15/M = $0.12
    // total = $0.24
    expect(estimateCostUsd(40_000, 8_000)).toBe(0.24);
  });

  it('exports Sonnet 4 pricing constants for downstream cost math', () => {
    expect(SONNET_4_INPUT_USD_PER_MTOK).toBe(3);
    expect(SONNET_4_OUTPUT_USD_PER_MTOK).toBe(15);
  });
});
