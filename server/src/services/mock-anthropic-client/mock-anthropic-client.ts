import type Anthropic from '@anthropic-ai/sdk';

/**
 * Deterministic mock of the @anthropic-ai/sdk client used by the
 * AgentOrchestrator. Drives a scripted three-iteration happy-path
 * conversation so the E2E suite can exercise the chat surface
 * end-to-end without burning Anthropic tokens or requiring an API
 * key in CI.
 *
 * Iteration sequence (driven by the assistant message count in
 * the messages array passed to stream()):
 *
 * - Iteration 1 (0 assistant messages so far): emit tool_use blocks
 *   for `search_flights` and `search_hotels` against the canonical
 *   DEN -> SFO sample. The orchestrator will run those via the
 *   existing tool executor (which routes to mock adapters when
 *   E2E_MOCK_TOOLS=1) and append tool_result blocks to the
 *   conversation.
 * - Iteration 2 (1 assistant message): emit a single tool_use for
 *   `format_response` with text plus quick_replies. The executor
 *   echoes the input back; AgentOrchestrator captures it as
 *   formatResponseData.
 * - Iteration 3 (2+ assistant messages): emit a plain end_turn so
 *   the loop terminates.
 *
 * The script intentionally produces the smallest realistic node
 * graph that exercises:
 * - flight tile rendering (search_flights -> buildNodeFromToolResult)
 * - hotel tile rendering (search_hotels -> buildNodeFromToolResult)
 * - quick reply chips (format_response.quick_replies)
 *
 * Anything beyond this happy path (multi-turn user replies, tile
 * selection round-trips, booking confirmation) is intentionally
 * not supported. ENG-17 in ISSUES.md tracks the larger expansion.
 */

const MOCK_END_TEXT =
  'Here are some options I found. Let me know which you prefer.';

const MOCK_QUICK_REPLIES = [
  "I'll take the cheapest flight",
  'Show me more hotels',
  'Confirm booking',
];

interface MessageParam {
  role: 'user' | 'assistant';
  content: unknown;
}

interface StreamParams {
  messages: MessageParam[];
  [key: string]: unknown;
}

interface MockStreamListeners {
  text: Array<(chunk: string) => void>;
}

type MockContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'tool_use';
      id: string;
      name: string;
      input: Record<string, unknown>;
    };

interface MockFinalMessage {
  content: MockContentBlock[];
  stop_reason: 'end_turn' | 'tool_use';
  usage: { input_tokens: number; output_tokens: number };
}

function countAssistantMessages(messages: MessageParam[]): number {
  return messages.filter((m) => m.role === 'assistant').length;
}

function buildIterationOneToolUse(): MockFinalMessage {
  return {
    content: [
      {
        type: 'tool_use',
        id: 'mock-toolu-flights-1',
        name: 'search_flights',
        // Field names must match searchFlightsSchema exactly:
        // origin, destination, departure_date, return_date,
        // passengers (not "adults"). Mismatched field names get
        // rejected by Zod, the executor turns the error into a
        // string result, and buildNodeFromToolResult returns
        // null instead of a flight_tiles node. The result is a
        // silently empty chat with no tiles.
        input: {
          origin: 'DEN',
          destination: 'SFO',
          departure_date: '2026-06-01',
          return_date: '2026-06-04',
          passengers: 2,
        },
      },
      {
        type: 'tool_use',
        id: 'mock-toolu-hotels-1',
        name: 'search_hotels',
        // Field names must match searchHotelsSchema exactly:
        // city (not "location"), check_in (not "check_in_date"),
        // check_out (not "check_out_date"), guests (not "adults").
        input: {
          city: 'San Francisco',
          check_in: '2026-06-01',
          check_out: '2026-06-04',
          guests: 2,
        },
      },
    ],
    stop_reason: 'tool_use',
    usage: { input_tokens: 0, output_tokens: 0 },
  };
}

function buildIterationTwoFormatResponse(): MockFinalMessage {
  return {
    content: [
      {
        type: 'tool_use',
        id: 'mock-toolu-format-1',
        name: 'format_response',
        input: {
          text: MOCK_END_TEXT,
          quick_replies: MOCK_QUICK_REPLIES,
        },
      },
    ],
    stop_reason: 'tool_use',
    usage: { input_tokens: 0, output_tokens: 0 },
  };
}

function buildEndTurn(): MockFinalMessage {
  return {
    content: [{ type: 'text', text: MOCK_END_TEXT }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 0, output_tokens: MOCK_END_TEXT.length },
  };
}

class MockMessageStream {
  private readonly listeners: MockStreamListeners = { text: [] };
  private readonly response: MockFinalMessage;

  constructor(messages: MessageParam[]) {
    const assistantCount = countAssistantMessages(messages);
    if (assistantCount === 0) {
      this.response = buildIterationOneToolUse();
    } else if (assistantCount === 1) {
      this.response = buildIterationTwoFormatResponse();
    } else {
      this.response = buildEndTurn();
    }
  }

  on(event: 'text', cb: (chunk: string) => void): this {
    if (event === 'text') {
      this.listeners.text.push(cb);
    }
    return this;
  }

  async finalMessage(): Promise<MockFinalMessage> {
    // Emit text deltas only when the response is end_turn (the
    // tool_use iterations have no text to stream).
    const textBlock = this.response.content.find(
      (b): b is { type: 'text'; text: string } => b.type === 'text',
    );
    if (textBlock) {
      for (const word of textBlock.text.split(' ')) {
        for (const cb of this.listeners.text) {
          cb(`${word} `);
        }
      }
    }
    return this.response;
  }
}

export class MockAnthropicClient {
  messages = {
    stream: (params: StreamParams): MockMessageStream =>
      new MockMessageStream(params.messages ?? []),
  };
}

/**
 * True when the server should swap the real Anthropic SDK for the
 * deterministic mock. Recognized only as the literal string '1'
 * to avoid accidental activation from truthy strings.
 */
export function isAnthropicMockMode(): boolean {
  return process.env.E2E_MOCK_ANTHROPIC === '1';
}

/**
 * Returns a mock client when E2E_MOCK_ANTHROPIC=1, otherwise
 * undefined. Callers should fall back to constructing a real
 * Anthropic client when this returns undefined.
 *
 * The return type is cast to `Anthropic` because the orchestrator's
 * config field is typed against the real SDK class. The mock only
 * implements the subset of methods the orchestrator actually calls;
 * any other access at runtime is a programming error and should
 * crash loudly.
 */
export function getMockAnthropicClientIfEnabled(): Anthropic | undefined {
  if (!isAnthropicMockMode()) {
    return undefined;
  }
  return new MockAnthropicClient() as unknown as Anthropic;
}
