import type { ChatMessage, ChatNode } from "@agentic-travel-agent/shared-types";
import {
  DEFAULT_COMPLETION_TRACKER,
  computeNudge,
  hasAnySelection,
  normalizeCompletionTracker,
  updateCompletionTracker,
} from "app/prompts/booking-steps.js";
import {
  getMessagesByConversation,
  getOrCreateConversation,
  insertMessage,
  updateBookingState,
} from "app/repositories/conversations/conversations.js";
import { getTripWithDetails } from "app/repositories/trips/trips.js";
import { findByUserId as findUserPreferences } from "app/repositories/userPreferences/userPreferences.js";
import { runAgentLoop } from "app/services/agent.service.js";
import { getEnrichmentNodes } from "app/services/enrichment.js";
import { logger } from "app/utils/logs/logger.js";
import type { Request, Response } from "express";

import {
  buildClaudeMessages,
  buildMissingFieldsForm,
  buildTripContext,
  computeFlowPosition,
  createSSEEmitter,
  flushSSE,
  toFlowInput,
} from "./chat.helpers.js";

// In-memory lock to prevent concurrent agent loops per conversation
const activeConversations = new Set<string>();

export async function chat(req: Request, res: Response) {
  const tripId = req.params.id as string;
  const userId = req.user!.id;
  const { message } = req.body;

  if (!message || typeof message !== "string") {
    res
      .status(400)
      .json({ error: "VALIDATION_ERROR", message: "message is required" });
    return;
  }

  const trip = await getTripWithDetails(tripId, userId);
  if (!trip) {
    res.status(404).json({ error: "NOT_FOUND", message: "Trip not found" });
    return;
  }

  const userPrefs = await findUserPreferences(userId);
  const conversation = await getOrCreateConversation(tripId);

  if (activeConversations.has(conversation.id)) {
    res.status(409).json({
      error: "CONFLICT",
      message:
        "A response is already being generated for this trip. Please wait.",
    });
    return;
  }
  activeConversations.add(conversation.id);

  const history = await getMessagesByConversation(conversation.id);
  const claudeMessages = buildClaudeMessages(history, message);
  const tripContext = buildTripContext(trip, userPrefs);

  // Set up SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.setTimeout(0);
  req.socket.setTimeout(150_000);

  req.on("close", () => {
    activeConversations.delete(conversation.id);
  });

  // Persist user message
  await insertMessage({
    conversation_id: conversation.id,
    role: "user",
    content: message,
    nodes: [{ type: "text", content: message }],
  });

  // Fetch enrichment on first message only
  const isFirstMessage = history.length === 0;
  let enrichmentNodes: ChatNode[] = [];
  if (trip.destination && isFirstMessage) {
    try {
      enrichmentNodes =
        (await getEnrichmentNodes(
          trip.destination,
          trip.origin ?? undefined,
        )) ?? [];
    } catch (err) {
      logger.warn({ err, tripId }, "Failed to fetch enrichment nodes");
    }
  }

  const hasCriticalAdvisory = enrichmentNodes.some(
    (n) =>
      n.type === "advisory" && "severity" in n && n.severity === "critical",
  );

  const onEvent = createSSEEmitter(res);

  const tracker = normalizeCompletionTracker(
    conversation.booking_state ?? DEFAULT_COMPLETION_TRACKER,
  );

  const flowPosition = computeFlowPosition(trip);
  const nudge = computeNudge(tracker);

  try {
    const result = await runAgentLoop(
      claudeMessages,
      tripContext,
      onEvent,
      conversation.id,
      { tripId, userId },
      enrichmentNodes,
      flowPosition,
      { hasCriticalAdvisory, nudge },
      tracker,
    );

    // Post-loop: check for missing fields and update completion tracker
    const updatedTrip = await getTripWithDetails(tripId, userId);
    if (updatedTrip) {
      const updatedPosition = computeFlowPosition(updatedTrip);
      if (updatedPosition.phase === "COLLECT_DETAILS") {
        const formNode = buildMissingFieldsForm(updatedTrip);
        if (formNode) result.nodes.push(formNode);
      }

      const newTracker = updateCompletionTracker(
        tracker,
        result,
        toFlowInput(updatedTrip),
      );

      // Empty itinerary guard
      if (!hasAnySelection(newTracker)) {
        const allSkippedOrPending = (
          ["flights", "hotels", "car_rental", "experiences"] as const
        ).every((cat) => {
          const status = newTracker[cat];
          return status === "skipped" || status === "pending";
        });
        if (allSkippedOrPending) {
          result.nodes.push({
            type: "text",
            content:
              "You haven't selected anything for your trip yet. Want to go back and explore some options?",
          });
        }
      }

      await updateBookingState(
        conversation.id,
        newTracker as unknown as Record<string, unknown>,
      );
    }

    // Persist assistant message
    const assistantMessage = await insertMessage({
      conversation_id: conversation.id,
      role: "assistant",
      content: result.response,
      tool_calls_json:
        result.tool_calls.length > 0 ? result.tool_calls : undefined,
      nodes: result.nodes,
      token_count: result.total_tokens.input + result.total_tokens.output,
    });

    const chatMessage: ChatMessage = {
      id: assistantMessage.id,
      role: "assistant",
      nodes: result.nodes,
      sequence: assistantMessage.sequence,
      created_at: assistantMessage.created_at,
    };
    res.write(
      `event: done\ndata: ${JSON.stringify({ type: "done", message: chatMessage })}\n\n`,
    );
    flushSSE(res);
  } catch (err) {
    logger.error({ err, tripId }, "Agent loop failed");
    res.write(
      `event: error\ndata: ${JSON.stringify({ type: "error", error: "Agent encountered an error" })}\n\n`,
    );
    flushSSE(res);
  } finally {
    activeConversations.delete(conversation.id);
    res.end();
  }
}

export async function getMessages(req: Request, res: Response) {
  const tripId = req.params.id as string;
  const userId = req.user!.id;

  const trip = await getTripWithDetails(tripId, userId);
  if (!trip) {
    res.status(404).json({ error: "NOT_FOUND", message: "Trip not found" });
    return;
  }

  const conversation = await getOrCreateConversation(tripId);
  const dbMessages = await getMessagesByConversation(conversation.id);

  const messages: ChatMessage[] = dbMessages
    .filter((m) => m.role !== ("tool" as string))
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      nodes:
        m.nodes && m.nodes.length > 0
          ? m.nodes
          : [{ type: "text" as const, content: m.content ?? "" }],
      sequence: m.sequence,
      created_at: m.created_at,
    }));

  if (messages.length === 0) {
    const isPlaceholder =
      !trip.destination || trip.destination === "Planning...";

    const welcomeText = isPlaceholder
      ? "Hi! I'd love to help plan your trip. Where would you like to go, when are you traveling, and what's your budget?"
      : `Great choice! Let's plan your trip to **${trip.destination}**. When are you traveling, what's your budget, and where will you be coming from?`;

    messages.unshift({
      id: "welcome",
      role: "assistant",
      nodes: [{ type: "text", content: welcomeText }],
      sequence: 0,
      created_at: new Date().toISOString(),
    });
  }

  res.json({ messages });
}
