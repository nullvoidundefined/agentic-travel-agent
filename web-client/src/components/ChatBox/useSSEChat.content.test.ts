import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Content guard for useSSEChat error handling.
 *
 * Locks in the UX-03 fix: the pre-audit hook routed both raw SSE
 * error events and fetch failures through setStreamingText, which
 * meant the UI displayed raw error messages inline inside the chat
 * bubble instead of routing through the Toast convention in
 * CLAUDE-FRONTEND.md.
 */

const hookPath = resolve(__dirname, 'useSSEChat.ts');
const hookSource = readFileSync(hookPath, 'utf-8');

describe('useSSEChat error handling', () => {
  it('does not write raw error text into streamingText', () => {
    // Pre-audit anti-pattern: setStreamingText(event.error)
    expect(hookSource).not.toMatch(/setStreamingText\(event\.error\)/);
  });

  it('does not write a hardcoded "Something went wrong" into streamingText', () => {
    expect(hookSource).not.toMatch(
      /setStreamingText\(['"]Something went wrong/,
    );
  });

  it('exposes an error state that consumers can route to Toast', () => {
    const hasErrorState =
      /setError|const \[error/.test(hookSource) &&
      /error:\s*string\s*\|\s*null|error\?:/.test(hookSource);
    expect(hasErrorState).toBe(true);
  });

  it('exposes a clearError function for retry flows', () => {
    expect(hookSource).toMatch(/clearError/);
  });
});
