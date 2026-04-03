import type {
  ChatNode,
  Citation,
  SSEEvent,
} from '@agentic-travel-agent/shared-types';
import type Anthropic from '@anthropic-ai/sdk';
import { type FlowPosition } from 'app/prompts/booking-steps.js';
import { buildSystemPrompt } from 'app/prompts/system-prompt.js';
import type { TripContext } from 'app/prompts/trip-context.js';
import { insertToolCallLog } from 'app/repositories/tool-call-log/tool-call-log.js';
import {
  AgentOrchestrator,
  type OrchestratorResult,
} from 'app/services/AgentOrchestrator.js';
import { TOOL_DEFINITIONS } from 'app/tools/definitions.js';
import { type ToolContext, executeTool } from 'app/tools/executor.js';
import { logger } from 'app/utils/logs/logger.js';

export interface AgentResult {
  response: string;
  tool_calls: OrchestratorResult['toolCallsUsed'];
  total_tokens: OrchestratorResult['tokensUsed'];
  nodes: ChatNode[];
}

/**
 * Runs the agentic tool-use loop and assembles typed ChatNode results.
 */
export async function runAgentLoop(
  messages: Anthropic.MessageParam[],
  tripContext: TripContext | undefined,
  onEvent: (event: SSEEvent) => void,
  conversationId?: string | null,
  toolContext?: ToolContext,
  enrichmentNodes?: ChatNode[],
  flowPosition?: FlowPosition,
): Promise<AgentResult> {
  // Emit enrichment nodes first so the frontend can render them immediately
  if (enrichmentNodes) {
    for (const node of enrichmentNodes) {
      onEvent({ type: 'node', node });
    }
  }

  const orchestrator = new AgentOrchestrator({
    tools: TOOL_DEFINITIONS as Anthropic.Tool[],
    systemPromptBuilder: (ctx: unknown, pos: unknown) =>
      buildSystemPrompt(
        ctx as TripContext | undefined,
        pos as FlowPosition | undefined,
      ),
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

  const result = await orchestrator.run(
    messages,
    [tripContext, flowPosition],
    onEvent,
    meta,
  );

  // Assemble final node array per spec order
  const finalNodes: ChatNode[] = [];

  // 1. Enrichment nodes
  if (enrichmentNodes) finalNodes.push(...enrichmentNodes);

  // 2. Tool result nodes (excluding budget_bar — reorder below)
  const toolNodes = result.nodes.filter((n) => n.type !== 'budget_bar');
  finalNodes.push(...toolNodes);

  // 3. Text node from format_response or fallback to raw response
  if (result.formatResponse) {
    finalNodes.push({
      type: 'text',
      content: result.formatResponse.text,
      citations: result.formatResponse.citations as Citation[] | undefined,
    });
  } else if (result.response) {
    finalNodes.push({ type: 'text', content: result.response });
  }

  // 4. Budget bar (moved to after text)
  const budgetNode = result.nodes.find((n) => n.type === 'budget_bar');
  if (budgetNode) finalNodes.push(budgetNode);

  // 5. Advisory from format_response
  if (result.formatResponse?.advisory) {
    finalNodes.push({
      type: 'advisory',
      ...result.formatResponse.advisory,
    });
  }

  // 6. Quick replies
  if (result.formatResponse?.quick_replies?.length) {
    finalNodes.push({
      type: 'quick_replies',
      options: result.formatResponse.quick_replies,
    });
  }

  return {
    response: result.formatResponse?.text ?? result.response,
    tool_calls: result.toolCallsUsed,
    total_tokens: result.tokensUsed,
    nodes: finalNodes,
  };
}
