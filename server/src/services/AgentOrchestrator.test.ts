import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SSEEvent } from '@agentic-travel-agent/shared-types';
import {
  AgentOrchestrator,
  type AgentOrchestratorConfig,
} from './AgentOrchestrator.js';

// ---------------------------------------------------------------------------
// Mock the logger so we don't pollute test output
// ---------------------------------------------------------------------------
vi.mock('app/utils/logs/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the node builder — not the focus of these tests
vi.mock('./node-builder.js', () => ({
  buildNodeFromToolResult: vi.fn().mockReturnValue(null),
}));

// ---------------------------------------------------------------------------
// Helpers to build Anthropic-shaped responses
// ---------------------------------------------------------------------------
function makeTextResponse(text: string, inputTokens = 10, outputTokens = 20) {
  return {
    content: [{ type: 'text' as const, text }],
    stop_reason: 'end_turn' as const,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

function makeToolUseResponse(
  tools: { id: string; name: string; input: Record<string, unknown> }[],
  inputTokens = 15,
  outputTokens = 25,
) {
  return {
    content: tools.map((t) => ({
      type: 'tool_use' as const,
      id: t.id,
      name: t.name,
      input: t.input,
    })),
    stop_reason: 'tool_use' as const,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

// ---------------------------------------------------------------------------
// Helper to create a mock stream from a response object
// ---------------------------------------------------------------------------
function createMockStream(response: Record<string, unknown>) {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
  return {
    on(event: string, cb: (...args: unknown[]) => void) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
      return this; // chainable
    },
    async finalMessage() {
      // Emit text for text blocks
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

// ---------------------------------------------------------------------------
// Default orchestrator config factory
// ---------------------------------------------------------------------------
function createConfig(
  overrides?: Partial<AgentOrchestratorConfig>,
): AgentOrchestratorConfig {
  const mockStream = vi.fn();
  const mockClient = { messages: { stream: mockStream } } as never;

  return {
    tools: [
      {
        name: 'test_tool',
        description: 'A test tool',
        input_schema: {
          type: 'object' as const,
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
    ],
    systemPromptBuilder: (...args: unknown[]) =>
      `System prompt for ${JSON.stringify(args)}`,
    toolExecutor: vi.fn().mockResolvedValue({ result: 'ok' }),
    client: mockClient,
    ...overrides,
  };
}

function getStreamMock(config: AgentOrchestratorConfig): Mock {
  return (config.client as unknown as { messages: { stream: Mock } }).messages
    .stream;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AgentOrchestrator', () => {
  let config: AgentOrchestratorConfig;
  let streamMock: Mock;

  beforeEach(() => {
    vi.restoreAllMocks();
    config = createConfig();
    streamMock = getStreamMock(config);
  });

  // -----------------------------------------------------------------------
  // stop_reason: end_turn — returns text immediately
  // -----------------------------------------------------------------------
  it('returns the assistant response on end_turn', async () => {
    streamMock.mockReturnValueOnce(createMockStream(makeTextResponse('Hello traveler!')));

    const orchestrator = new AgentOrchestrator(config);
    const result = await orchestrator.run(
      [{ role: 'user', content: 'Hi' }],
      ['ctx'],
    );

    expect(result.response).toBe('Hello traveler!');
    expect(result.toolCallsUsed).toHaveLength(0);
    expect(result.iterations).toBe(1);
    expect(result.tokensUsed).toEqual({ input: 10, output: 20 });
  });

  // -----------------------------------------------------------------------
  // Tool call execution — tools called with correct input
  // -----------------------------------------------------------------------
  it('executes tool calls and returns final response', async () => {
    const toolInput = { query: 'flights to paris' };
    streamMock
      .mockReturnValueOnce(
        createMockStream(
          makeToolUseResponse([
            { id: 'tool_1', name: 'test_tool', input: toolInput },
          ]),
        ),
      )
      .mockReturnValueOnce(
        createMockStream(makeTextResponse('Found flights for you!')),
      );

    const orchestrator = new AgentOrchestrator(config);
    const result = await orchestrator.run(
      [{ role: 'user', content: 'Find flights' }],
      [],
    );

    expect(config.toolExecutor).toHaveBeenCalledWith(
      'test_tool',
      toolInput,
      undefined,
    );
    expect(result.toolCallsUsed).toHaveLength(1);
    expect(result.toolCallsUsed[0]!.tool_name).toBe('test_tool');
    expect(result.toolCallsUsed[0]!.input).toEqual(toolInput);
    expect(result.response).toBe('Found flights for you!');
    expect(result.iterations).toBe(2);
  });

  // -----------------------------------------------------------------------
  // Meta is passed to tool executor
  // -----------------------------------------------------------------------
  it('passes meta to the tool executor', async () => {
    streamMock
      .mockReturnValueOnce(
        createMockStream(
          makeToolUseResponse([
            { id: 'tool_1', name: 'test_tool', input: { query: 'x' } },
          ]),
        ),
      )
      .mockReturnValueOnce(createMockStream(makeTextResponse('Done')));

    const orchestrator = new AgentOrchestrator(config);
    await orchestrator.run([{ role: 'user', content: 'Go' }], [], undefined, {
      tripId: 'trip_123',
      userId: 'user_456',
    });

    expect(config.toolExecutor).toHaveBeenCalledWith(
      'test_tool',
      { query: 'x' },
      { tripId: 'trip_123', userId: 'user_456' },
    );
  });

  // -----------------------------------------------------------------------
  // Max iteration enforcement
  // -----------------------------------------------------------------------
  it('stops after reaching the max tool call limit', async () => {
    const orchestratorConfig = createConfig({ maxIterations: 2 });
    const mockStream = getStreamMock(orchestratorConfig);

    // First call: 1 tool use
    mockStream.mockReturnValueOnce(
      createMockStream(
        makeToolUseResponse([
          { id: 'tool_1', name: 'test_tool', input: { query: 'a' } },
        ]),
      ),
    );
    // Second call: 2 more tool uses — would push total to 3 > limit of 2
    mockStream.mockReturnValueOnce(
      createMockStream(
        makeToolUseResponse([
          { id: 'tool_2', name: 'test_tool', input: { query: 'b' } },
          { id: 'tool_3', name: 'test_tool', input: { query: 'c' } },
        ]),
      ),
    );

    const orchestrator = new AgentOrchestrator(orchestratorConfig);
    const result = await orchestrator.run(
      [{ role: 'user', content: 'Go' }],
      [],
    );

    expect(result.response).toContain('tool call limit');
    expect(result.toolCallsUsed).toHaveLength(1); // only the first batch executed
    expect(result.iterations).toBe(2);
  });

  // -----------------------------------------------------------------------
  // Error during tool execution — continues gracefully
  // -----------------------------------------------------------------------
  it('handles tool execution errors gracefully', async () => {
    const failingExecutor = vi
      .fn()
      .mockRejectedValueOnce(new Error('API timeout'));

    const errorConfig = createConfig({ toolExecutor: failingExecutor });
    const mockStream = getStreamMock(errorConfig);

    mockStream
      .mockReturnValueOnce(
        createMockStream(
          makeToolUseResponse([
            { id: 'tool_1', name: 'test_tool', input: { query: 'x' } },
          ]),
        ),
      )
      .mockReturnValueOnce(
        createMockStream(makeTextResponse('Sorry, the search failed.')),
      );

    const orchestrator = new AgentOrchestrator(errorConfig);
    const result = await orchestrator.run(
      [{ role: 'user', content: 'Search' }],
      [],
    );

    expect(result.toolCallsUsed).toHaveLength(1);
    expect(result.toolCallsUsed[0]!.result).toBe('Error: API timeout');
    expect(result.response).toBe('Sorry, the search failed.');

    // Verify the second call to Anthropic included is_error in tool result
    const secondCallMessages = mockStream.mock.calls[1]![0].messages;
    const lastUserMsg = secondCallMessages[secondCallMessages.length - 1];
    expect(lastUserMsg.content[0].is_error).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Event emission — onEvent callback receives correct events
  // -----------------------------------------------------------------------
  it('emits events for tool_progress and text_delta', async () => {
    const events: SSEEvent[] = [];
    const onEvent = (e: SSEEvent) => events.push(e);

    streamMock
      .mockReturnValueOnce(
        createMockStream(
          makeToolUseResponse([
            {
              id: 'tool_1',
              name: 'test_tool',
              input: { query: 'paris' },
            },
          ]),
        ),
      )
      .mockReturnValueOnce(
        createMockStream(makeTextResponse('Here are your results.')),
      );

    const orchestrator = new AgentOrchestrator(config);
    await orchestrator.run([{ role: 'user', content: 'Search' }], [], onEvent);

    // tool_progress running + tool_progress done + text_delta per character
    const toolProgressEvents = events.filter(
      (e) => e.type === 'tool_progress',
    );
    const textDeltaEvents = events.filter((e) => e.type === 'text_delta');

    expect(toolProgressEvents).toHaveLength(2);
    expect(toolProgressEvents[0]).toEqual({
      type: 'tool_progress',
      tool_name: 'test_tool',
      tool_id: 'tool_1',
      status: 'running',
    });
    expect(toolProgressEvents[1]).toEqual({
      type: 'tool_progress',
      tool_name: 'test_tool',
      tool_id: 'tool_1',
      status: 'done',
    });

    // Streaming emits text token by token — reconstruct the full text
    const streamedText = textDeltaEvents
      .map((e) => (e as { type: 'text_delta'; content: string }).content)
      .join('');
    expect(streamedText).toBe('Here are your results.');
  });

  // -----------------------------------------------------------------------
  // onToolExecuted callback receives correct data
  // -----------------------------------------------------------------------
  it('calls onToolExecuted with tool execution details', async () => {
    const onToolExecuted = vi.fn();
    const toolConfig = createConfig({ onToolExecuted });
    const mockStream = getStreamMock(toolConfig);

    mockStream
      .mockReturnValueOnce(
        createMockStream(
          makeToolUseResponse([
            { id: 'tool_1', name: 'test_tool', input: { query: 'x' } },
          ]),
        ),
      )
      .mockReturnValueOnce(createMockStream(makeTextResponse('Done')));

    const orchestrator = new AgentOrchestrator(toolConfig);
    await orchestrator.run([{ role: 'user', content: 'Go' }], []);

    expect(onToolExecuted).toHaveBeenCalledOnce();
    const call = onToolExecuted.mock.calls[0]![0];
    expect(call.tool_name).toBe('test_tool');
    expect(call.tool_id).toBe('tool_1');
    expect(call.isError).toBe(false);
    expect(call.errorMessage).toBeNull();
    expect(call.latencyMs).toBeGreaterThanOrEqual(0);
  });

  // -----------------------------------------------------------------------
  // Token accumulation across iterations
  // -----------------------------------------------------------------------
  it('accumulates tokens across multiple iterations', async () => {
    streamMock
      .mockReturnValueOnce(
        createMockStream(
          makeToolUseResponse(
            [{ id: 'tool_1', name: 'test_tool', input: { query: 'a' } }],
            100,
            50,
          ),
        ),
      )
      .mockReturnValueOnce(
        createMockStream(makeTextResponse('Done', 200, 80)),
      );

    const orchestrator = new AgentOrchestrator(config);
    const result = await orchestrator.run(
      [{ role: 'user', content: 'Go' }],
      [],
    );

    expect(result.tokensUsed).toEqual({ input: 300, output: 130 });
  });

  // -----------------------------------------------------------------------
  // System prompt builder is called with correct args
  // -----------------------------------------------------------------------
  it('passes systemPromptArgs to the systemPromptBuilder', async () => {
    const builder = vi.fn().mockReturnValue('Built prompt');
    const builderConfig = createConfig({ systemPromptBuilder: builder });
    const mockStream = getStreamMock(builderConfig);
    mockStream.mockReturnValueOnce(createMockStream(makeTextResponse('Hi')));

    const orchestrator = new AgentOrchestrator(builderConfig);
    await orchestrator.run(
      [{ role: 'user', content: 'Hello' }],
      [{ destination: 'Paris' }, 'extra'],
    );

    expect(builder).toHaveBeenCalledWith({ destination: 'Paris' }, 'extra');
    expect(mockStream.mock.calls[0]![0].system).toBe('Built prompt');
  });
});
