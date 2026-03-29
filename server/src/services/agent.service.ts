import type Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from 'app/prompts/system-prompt.js';
import type { TripContext } from 'app/prompts/trip-context.js';
import { insertToolCallLog } from 'app/repositories/tool-call-log/tool-call-log.js';
import {
  AgentOrchestrator,
  type OrchestratorResult,
  type ProgressEvent,
} from 'app/services/AgentOrchestrator.js';
import { TOOL_DEFINITIONS } from 'app/tools/definitions.js';
import { type ToolContext, executeTool } from 'app/tools/executor.js';
import { logger } from 'app/utils/logs/logger.js';

/** @deprecated Use AgentOrchestrator directly for new code. */
interface AgentResult {
  response: string;
  tool_calls: OrchestratorResult['toolCallsUsed'];
  total_tokens: OrchestratorResult['tokensUsed'];
}

/**
 * Legacy wrapper around AgentOrchestrator.
 * Preserves the original function signature so callers (chat handler) keep working.
 */
export async function runAgentLoop(
  messages: Anthropic.MessageParam[],
  tripContext: TripContext | undefined,
  onEvent: (event: ProgressEvent) => void,
  conversationId?: string | null,
  toolContext?: ToolContext,
): Promise<AgentResult> {
  const orchestrator = new AgentOrchestrator({
    tools: TOOL_DEFINITIONS as Anthropic.Tool[],
    systemPromptBuilder: (ctx: unknown) =>
      buildSystemPrompt(ctx as TripContext | undefined),
    toolExecutor: (toolName, input, meta) =>
      executeTool(toolName, input, meta as ToolContext | undefined),
    onToolExecuted: (record) => {
      insertToolCallLog({
        conversation_id: conversationId ?? null,
        tool_name: record.tool_name,
        tool_input_json: record.input,
        tool_result_json: record.isError ? null : record.result,
        latency_ms: record.latencyMs,
        cache_hit: false,
        error: record.errorMessage,
      }).catch((logErr) => {
        logger.warn({ err: logErr }, 'Failed to log tool call');
      });
    },
  });

  const meta = toolContext
    ? ({ tripId: toolContext.tripId, userId: toolContext.userId } as Record<
        string,
        unknown
      >)
    : undefined;

  const result = await orchestrator.run(messages, [tripContext], onEvent, meta);

  return {
    response: result.response,
    tool_calls: result.toolCallsUsed,
    total_tokens: result.tokensUsed,
  };
}
