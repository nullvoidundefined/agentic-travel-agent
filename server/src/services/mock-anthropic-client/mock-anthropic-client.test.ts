import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MockAnthropicClient,
  isAnthropicMockMode,
} from './mock-anthropic-client.js';

describe('MockAnthropicClient', () => {
  it('exposes a messages.stream method that satisfies the orchestrator interface', () => {
    const client = new MockAnthropicClient();
    expect(typeof client.messages.stream).toBe('function');
  });

  describe('iteration scripting based on assistant message count', () => {
    it('iteration 1 (no prior assistant messages): emits search_flights and search_hotels tool_use', async () => {
      const client = new MockAnthropicClient();
      const stream = client.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: 'test',
        tools: [],
        messages: [{ role: 'user', content: 'Plan a trip to SF' }],
      });

      const final = await stream.finalMessage();

      expect(final.stop_reason).toBe('tool_use');
      expect(final.content).toHaveLength(2);
      const names = final.content
        .map((b) => (b.type === 'tool_use' ? b.name : null))
        .filter(Boolean);
      expect(names).toEqual(['search_flights', 'search_hotels']);
    });

    it('iteration 2 (one prior assistant message): emits format_response tool_use with text and quick_replies', async () => {
      const client = new MockAnthropicClient();
      const stream = client.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: 'test',
        tools: [],
        messages: [
          { role: 'user', content: 'Plan a trip to SF' },
          { role: 'assistant', content: [] },
          { role: 'user', content: [] },
        ],
      });

      const final = await stream.finalMessage();

      expect(final.stop_reason).toBe('tool_use');
      expect(final.content).toHaveLength(1);
      const block = final.content[0];
      if (block?.type !== 'tool_use') {
        throw new Error('expected tool_use block');
      }
      expect(block.name).toBe('format_response');
      const input = block.input as {
        text: string;
        quick_replies: string[];
      };
      expect(input.text).toBeTruthy();
      expect(input.quick_replies.length).toBeGreaterThan(0);
    });

    it('iteration 1 tool_use inputs conform to the actual tool schemas', async () => {
      // Regression: PR #11 first attempt shipped a mock that
      // used `adults` instead of `passengers`, `location` instead
      // of `city`, etc. Zod rejected the inputs, the executor
      // turned the errors into string results, and
      // buildNodeFromToolResult returned null. The chat surfaced
      // text + quick_replies but no tile cards, and the e2e
      // suite failed without any obvious error in the logs.
      // This test locks the field names so the same mistake
      // cannot regress silently.
      const { searchFlightsSchema, searchHotelsSchema } =
        await import('app/tools/schemas.js');

      const client = new MockAnthropicClient();
      const stream = client.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: 'test',
        tools: [],
        messages: [{ role: 'user', content: 'Plan a trip' }],
      });
      const final = await stream.finalMessage();

      const flightsBlock = final.content.find(
        (b) => b.type === 'tool_use' && b.name === 'search_flights',
      );
      const hotelsBlock = final.content.find(
        (b) => b.type === 'tool_use' && b.name === 'search_hotels',
      );
      if (flightsBlock?.type !== 'tool_use') {
        throw new Error('expected search_flights tool_use');
      }
      if (hotelsBlock?.type !== 'tool_use') {
        throw new Error('expected search_hotels tool_use');
      }

      // Both inputs must parse against their canonical Zod
      // schemas. If this fails, the mock is emitting field
      // names the executor will reject.
      expect(() => searchFlightsSchema.parse(flightsBlock.input)).not.toThrow();
      expect(() => searchHotelsSchema.parse(hotelsBlock.input)).not.toThrow();
    });

    it('iteration 3+ (two or more prior assistant messages): emits end_turn with text', async () => {
      const client = new MockAnthropicClient();
      const stream = client.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: 'test',
        tools: [],
        messages: [
          { role: 'user', content: 'Plan a trip' },
          { role: 'assistant', content: [] },
          { role: 'user', content: [] },
          { role: 'assistant', content: [] },
          { role: 'user', content: [] },
        ],
      });

      const final = await stream.finalMessage();

      expect(final.stop_reason).toBe('end_turn');
      expect(final.content[0]?.type).toBe('text');
      expect(final.usage.output_tokens).toBeGreaterThan(0);
    });
  });

  it('emits text events to listeners registered via .on() on the end_turn iteration', async () => {
    const client = new MockAnthropicClient();
    // Force the end_turn branch with two prior assistant messages.
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'test',
      tools: [],
      messages: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: [] },
        { role: 'user', content: [] },
        { role: 'assistant', content: [] },
      ],
    });

    const seen: string[] = [];
    stream.on('text', (chunk) => seen.push(chunk));
    await stream.finalMessage();

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.join('').trim().length).toBeGreaterThan(0);
  });

  it('returns a chainable .on() so callers can register multiple listeners fluently', () => {
    const client = new MockAnthropicClient();
    const stream = client.messages.stream({
      model: 'm',
      max_tokens: 1,
      system: '',
      tools: [],
      messages: [],
    });
    const result = stream.on('text', () => {}).on('text', () => {});
    expect(result).toBe(stream);
  });
});

describe('isAnthropicMockMode', () => {
  const ORIGINAL = process.env.E2E_MOCK_ANTHROPIC;

  beforeEach(() => {
    delete process.env.E2E_MOCK_ANTHROPIC;
  });

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.E2E_MOCK_ANTHROPIC;
    } else {
      process.env.E2E_MOCK_ANTHROPIC = ORIGINAL;
    }
    vi.unstubAllEnvs();
  });

  it('returns false when the env flag is unset', () => {
    expect(isAnthropicMockMode()).toBe(false);
  });

  it('returns true when E2E_MOCK_ANTHROPIC=1', () => {
    process.env.E2E_MOCK_ANTHROPIC = '1';
    expect(isAnthropicMockMode()).toBe(true);
  });

  it('returns false for any other value', () => {
    process.env.E2E_MOCK_ANTHROPIC = 'true';
    expect(isAnthropicMockMode()).toBe(false);
    process.env.E2E_MOCK_ANTHROPIC = '0';
    expect(isAnthropicMockMode()).toBe(false);
  });
});
