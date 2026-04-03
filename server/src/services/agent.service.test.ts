import Anthropic from '@anthropic-ai/sdk';
import { insertToolCallLog } from 'app/repositories/tool-call-log/tool-call-log.js';
import { runAgentLoop } from 'app/services/agent.service.js';
import { executeTool } from 'app/tools/executor.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk');
vi.mock('app/tools/executor.js');
vi.mock('app/tools/definitions.js', () => ({
  TOOL_DEFINITIONS: [
    {
      name: 'search_flights',
      description: 'Search flights',
      input_schema: { type: 'object', properties: {}, required: [] },
    },
  ],
}));
vi.mock('app/prompts/system-prompt.js', () => ({
  buildSystemPrompt: vi.fn().mockReturnValue('You are a travel planner.'),
}));
vi.mock('app/utils/logs/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('app/repositories/tool-call-log/tool-call-log.js', () => ({
  insertToolCallLog: vi.fn().mockResolvedValue({}),
}));

function createMockStream(response: Record<string, unknown>) {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
  return {
    on(event: string, cb: (...args: unknown[]) => void) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
      return this;
    },
    async finalMessage() {
      const content = response.content as
        | Array<{ type: string; text?: string }>
        | undefined;
      const textBlock = content?.find((b) => b.type === 'text');
      if (textBlock?.text && listeners['text']) {
        for (const char of textBlock.text) {
          for (const cb of listeners['text']) cb(char);
        }
      }
      return response;
    },
  };
}

describe('agent.service', () => {
  let mockStream: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(insertToolCallLog).mockResolvedValue({} as never);
    process.env.ANTHROPIC_API_KEY = 'test-key';

    mockStream = vi.fn();
    vi.mocked(Anthropic).mockImplementation(
      () =>
        ({
          messages: { stream: mockStream },
        }) as unknown as Anthropic,
    );
  });

  describe('runAgentLoop', () => {
    it('returns text response when Claude responds with end_turn', async () => {
      mockStream.mockReturnValueOnce(
        createMockStream({
          stop_reason: 'end_turn',
          content: [
            { type: 'text', text: 'Here is your itinerary for Barcelona!' },
          ],
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      );

      const events: unknown[] = [];
      const result = await runAgentLoop(
        [{ role: 'user', content: 'Plan a trip to Barcelona' }],
        undefined,
        (event) => events.push(event),
      );

      expect(result.response).toBe('Here is your itinerary for Barcelona!');
      expect(result.tool_calls).toHaveLength(0);
      expect(mockStream).toHaveBeenCalledTimes(1);
    });

    it('executes tool calls and loops back to Claude', async () => {
      // First call: Claude wants to use a tool
      mockStream.mockReturnValueOnce(
        createMockStream({
          stop_reason: 'tool_use',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_123',
              name: 'search_flights',
              input: {
                origin: 'SFO',
                destination: 'BCN',
                departure_date: '2026-07-01',
                passengers: 1,
              },
            },
          ],
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      );

      // Tool execution result
      vi.mocked(executeTool).mockResolvedValueOnce([
        { price: 450, airline: 'UA' },
      ]);

      // Second call: Claude responds with text
      mockStream.mockReturnValueOnce(
        createMockStream({
          stop_reason: 'end_turn',
          content: [
            { type: 'text', text: 'I found flights starting at $450.' },
          ],
          usage: { input_tokens: 200, output_tokens: 80 },
        }),
      );

      const events: unknown[] = [];
      const result = await runAgentLoop(
        [{ role: 'user', content: 'Plan a trip to Barcelona' }],
        undefined,
        (event) => events.push(event),
      );

      expect(result.response).toBe('I found flights starting at $450.');
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls[0]!.tool_name).toBe('search_flights');
      expect(mockStream).toHaveBeenCalledTimes(2);
      expect(executeTool).toHaveBeenCalledTimes(1);
    });

    it('emits progress events for tool calls', async () => {
      mockStream.mockReturnValueOnce(
        createMockStream({
          stop_reason: 'tool_use',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'search_flights',
              input: {
                origin: 'SFO',
                destination: 'BCN',
                departure_date: '2026-07-01',
                passengers: 1,
              },
            },
          ],
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      );

      vi.mocked(executeTool).mockResolvedValueOnce([]);

      mockStream.mockReturnValueOnce(
        createMockStream({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Done.' }],
          usage: { input_tokens: 200, output_tokens: 30 },
        }),
      );

      const events: Array<{ type: string }> = [];
      await runAgentLoop(
        [{ role: 'user', content: 'test' }],
        undefined,
        (event) => events.push(event as { type: string }),
      );

      const toolProgressEvents = events.filter(
        (e) => e.type === 'tool_progress',
      );
      // Two tool_progress events per tool call: running + done
      expect(toolProgressEvents).toHaveLength(2);
    });

    it('enforces max 15 tool calls per turn', async () => {
      // Make Claude always want to call a tool
      for (let i = 0; i < 16; i++) {
        mockStream.mockReturnValueOnce(
          createMockStream({
            stop_reason: 'tool_use',
            content: [
              {
                type: 'tool_use',
                id: `toolu_${i}`,
                name: 'search_flights',
                input: {
                  origin: 'SFO',
                  destination: 'BCN',
                  departure_date: '2026-07-01',
                  passengers: 1,
                },
              },
            ],
            usage: { input_tokens: 100, output_tokens: 50 },
          }),
        );
        vi.mocked(executeTool).mockResolvedValueOnce([]);
      }

      const result = await runAgentLoop(
        [{ role: 'user', content: 'test' }],
        undefined,
        () => {},
      );

      // Should stop at 15 tool calls
      expect(result.tool_calls.length).toBeLessThanOrEqual(15);
      expect(result.response).toContain('limit');
    });

    it('handles multiple tool calls in a single response', async () => {
      mockStream.mockReturnValueOnce(
        createMockStream({
          stop_reason: 'tool_use',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'search_flights',
              input: {
                origin: 'SFO',
                destination: 'BCN',
                departure_date: '2026-07-01',
                passengers: 1,
              },
            },
            {
              type: 'tool_use',
              id: 'toolu_2',
              name: 'get_destination_info',
              input: { city_name: 'Barcelona' },
            },
          ],
          usage: { input_tokens: 100, output_tokens: 80 },
        }),
      );

      vi.mocked(executeTool)
        .mockResolvedValueOnce([{ price: 450 }])
        .mockResolvedValueOnce({ iata_code: 'BCN' });

      mockStream.mockReturnValueOnce(
        createMockStream({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Got both results.' }],
          usage: { input_tokens: 300, output_tokens: 40 },
        }),
      );

      const result = await runAgentLoop(
        [{ role: 'user', content: 'test' }],
        undefined,
        () => {},
      );

      expect(result.tool_calls).toHaveLength(2);
      expect(executeTool).toHaveBeenCalledTimes(2);
    });

    it('handles tool execution errors gracefully', async () => {
      mockStream.mockReturnValueOnce(
        createMockStream({
          stop_reason: 'tool_use',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'search_flights',
              input: {
                origin: 'SFO',
                destination: 'BCN',
                departure_date: '2026-07-01',
                passengers: 1,
              },
            },
          ],
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      );

      vi.mocked(executeTool).mockRejectedValueOnce(
        new Error('Amadeus API timeout'),
      );

      // Claude should get the error and respond
      mockStream.mockReturnValueOnce(
        createMockStream({
          stop_reason: 'end_turn',
          content: [
            {
              type: 'text',
              text: 'I encountered an error searching flights.',
            },
          ],
          usage: { input_tokens: 200, output_tokens: 40 },
        }),
      );

      const result = await runAgentLoop(
        [{ role: 'user', content: 'test' }],
        undefined,
        () => {},
      );

      expect(result.response).toContain('error');
      // The tool result sent back to Claude should contain the error
      const secondCallMessages = mockStream.mock.calls[1]![0].messages;
      const toolResultMsg = secondCallMessages.find(
        (m: { role: string }) => m.role === 'user',
      );
      expect(toolResultMsg).toBeDefined();
    });

    it('logs tool calls for observability', async () => {
      mockStream.mockReturnValueOnce(
        createMockStream({
          stop_reason: 'tool_use',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_log',
              name: 'search_flights',
              input: { origin: 'SFO', destination: 'BCN' },
            },
          ],
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      );

      vi.mocked(executeTool).mockResolvedValueOnce([{ price: 450 }]);

      mockStream.mockReturnValueOnce(
        createMockStream({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Done.' }],
          usage: { input_tokens: 200, output_tokens: 30 },
        }),
      );

      await runAgentLoop(
        [{ role: 'user', content: 'test' }],
        undefined,
        () => {},
        'conv-123',
      );

      // Wait for fire-and-forget promise
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(insertToolCallLog).toHaveBeenCalledWith(
        expect.objectContaining({
          conversation_id: 'conv-123',
          tool_name: 'search_flights',
          tool_input_json: { origin: 'SFO', destination: 'BCN' },
          error: null,
        }),
      );
    });

    it('tracks total token usage', async () => {
      mockStream.mockReturnValueOnce(
        createMockStream({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Hello!' }],
          usage: { input_tokens: 150, output_tokens: 25 },
        }),
      );

      const result = await runAgentLoop(
        [{ role: 'user', content: 'Hi' }],
        undefined,
        () => {},
      );

      expect(result.total_tokens).toEqual({ input: 150, output: 25 });
    });
  });
});
