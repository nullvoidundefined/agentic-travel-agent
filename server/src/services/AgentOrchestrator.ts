import type { ChatNode, SSEEvent } from '@agentic-travel-agent/shared-types';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from 'app/utils/logs/logger.js';

import { buildNodeFromToolResult } from './node-builder.js';

const DEFAULT_MAX_ITERATIONS = 15;
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 4096;

export interface ToolCallRecord {
  tool_name: string;
  tool_id: string;
  input: Record<string, unknown>;
  result: unknown;
}

export interface FormatResponseData {
  text: string;
  citations?: unknown[];
  quick_replies?: string[];
  advisory?: {
    severity: 'info' | 'warning' | 'critical';
    title: string;
    body: string;
  };
  skip_category?: boolean;
}

export interface OrchestratorResult {
  response: string;
  toolCallsUsed: ToolCallRecord[];
  tokensUsed: { input: number; output: number };
  iterations: number;
  nodes: ChatNode[];
  formatResponse: FormatResponseData | null;
}

export type ToolExecutor = (
  toolName: string,
  input: Record<string, unknown>,
  meta?: Record<string, unknown>,
) => Promise<unknown>;

export type OnToolExecuted = (record: {
  tool_name: string;
  tool_id: string;
  input: Record<string, unknown>;
  result: unknown;
  isError: boolean;
  errorMessage: string | null;
  latencyMs: number;
}) => void;

export interface AgentOrchestratorConfig {
  tools: Anthropic.Tool[];
  systemPromptBuilder: (...args: unknown[]) => string;
  toolExecutor: ToolExecutor;
  maxIterations?: number;
  model?: string;
  maxTokens?: number;
  /** Called after each tool execution for logging/observability */
  onToolExecuted?: OnToolExecuted;
  /** Provide a custom Anthropic client (useful for testing) */
  client?: Anthropic;
}

export class AgentOrchestrator {
  private readonly tools: Anthropic.Tool[];
  private readonly systemPromptBuilder: (...args: unknown[]) => string;
  private readonly toolExecutor: ToolExecutor;
  private readonly maxIterations: number;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly onToolExecuted?: OnToolExecuted;
  private readonly client: Anthropic;

  constructor(config: AgentOrchestratorConfig) {
    this.tools = config.tools;
    this.systemPromptBuilder = config.systemPromptBuilder;
    this.toolExecutor = config.toolExecutor;
    this.maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.model = config.model ?? DEFAULT_MODEL;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.onToolExecuted = config.onToolExecuted;
    this.client = config.client ?? new Anthropic();
  }

  async run(
    messages: Anthropic.MessageParam[],
    systemPromptArgs: unknown[],
    onEvent?: (event: SSEEvent) => void,
    meta?: Record<string, unknown>,
  ): Promise<OrchestratorResult> {
    const systemPrompt = this.systemPromptBuilder(...systemPromptArgs);
    const toolCalls: ToolCallRecord[] = [];
    const tokensUsed = { input: 0, output: 0 };
    let iterations = 0;
    const collectedNodes: ChatNode[] = [];
    let formatResponseData: FormatResponseData | null = null;

    const conversationMessages = [...messages];

    while (true) {
      iterations++;

      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        tools: this.tools,
        messages: conversationMessages,
      });

      // Emit text tokens as they arrive (real-time typing animation)
      stream.on('text', (text) => {
        if (!formatResponseData) {
          onEvent?.({ type: 'text_delta', content: text });
        }
      });

      // Wait for the complete response
      const response = await stream.finalMessage();

      tokensUsed.input += response.usage.input_tokens;
      tokensUsed.output += response.usage.output_tokens;

      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find(
          (block): block is Anthropic.TextBlock => block.type === 'text',
        );
        const text = textBlock?.text ?? '';
        // Text was already emitted token-by-token via stream.on('text', ...)
        return {
          response: text,
          toolCallsUsed: toolCalls,
          tokensUsed,
          iterations,
          nodes: collectedNodes,
          formatResponse: formatResponseData,
        };
      }

      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
        );

        // Check tool call limit before executing
        if (toolCalls.length + toolUseBlocks.length > this.maxIterations) {
          return {
            response:
              "I've reached the tool call limit for this turn. Please send another message to continue.",
            toolCallsUsed: toolCalls,
            tokensUsed,
            iterations,
            nodes: collectedNodes,
            formatResponse: formatResponseData,
          };
        }

        // Add assistant message with tool use blocks
        conversationMessages.push({
          role: 'assistant',
          content: response.content,
        });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of toolUseBlocks) {
          const input = block.input as Record<string, unknown>;
          onEvent?.({
            type: 'tool_progress',
            tool_name: block.name,
            tool_id: block.id,
            status: 'running',
          });

          let result: unknown;
          let isError = false;
          let errorMessage: string | null = null;

          const startTime = Date.now();
          try {
            result = await this.toolExecutor(block.name, input, meta);
          } catch (err) {
            isError = true;
            errorMessage = err instanceof Error ? err.message : String(err);
            result = `Tool error (do not retry): ${errorMessage}`;
            logger.error(
              { err, toolName: block.name },
              'Tool execution failed',
            );
          }
          const latencyMs = Date.now() - startTime;

          const record: ToolCallRecord = {
            tool_name: block.name,
            tool_id: block.id,
            input,
            result,
          };
          toolCalls.push(record);

          // Build a typed node from the tool result
          const node = buildNodeFromToolResult(block.name, result);
          if (node) {
            collectedNodes.push(node);
            onEvent?.({ type: 'node', node });
          }

          // Detect format_response tool
          if (block.name === 'format_response') {
            formatResponseData = result as FormatResponseData;
          }

          onEvent?.({
            type: 'tool_progress',
            tool_name: block.name,
            tool_id: block.id,
            status: 'done',
          });

          this.onToolExecuted?.({
            ...record,
            isError,
            errorMessage,
            latencyMs,
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content:
              typeof result === 'string' ? result : JSON.stringify(result),
            ...(isError && { is_error: true }),
          });
        }

        conversationMessages.push({ role: 'user', content: toolResults });
      }
    }
  }
}
