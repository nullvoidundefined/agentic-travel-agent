import type {
  ChatNode,
  ChatMessage,
  SSEEvent,
} from '@agentic-travel-agent/shared-types';
import type { TripContext } from 'app/prompts/trip-context.js';
import {
  getMessagesByConversation,
  getOrCreateConversation,
  insertMessage,
} from 'app/repositories/conversations/conversations.js';
import { getTripWithDetails } from 'app/repositories/trips/trips.js';
import { findByUserId as findUserPreferences } from 'app/repositories/userPreferences/userPreferences.js';
import { getEnrichmentNodes } from 'app/services/enrichment.js';
import { runAgentLoop } from 'app/services/agent.service.js';
import { logger } from 'app/utils/logs/logger.js';
import type { Request, Response } from 'express';

export async function chat(req: Request, res: Response) {
  const tripId = req.params.id as string;
  const userId = req.user!.id;
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    res
      .status(400)
      .json({ error: 'VALIDATION_ERROR', message: 'message is required' });
    return;
  }

  // Load trip
  const trip = await getTripWithDetails(tripId, userId);
  if (!trip) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Trip not found' });
    return;
  }

  // Load user preferences
  const userPrefs = await findUserPreferences(userId);

  // Get or create conversation
  const conversation = await getOrCreateConversation(tripId);

  // Load conversation history
  const history = await getMessagesByConversation(conversation.id);

  // Build messages for Claude
  const claudeMessages = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content ?? '',
    }));

  // Add current message
  claudeMessages.push({ role: 'user', content: message });

  // Build trip context for system prompt
  const tripContext: TripContext = {
    destination: trip.destination,
    origin: trip.origin ?? null,
    departure_date: trip.departure_date ?? null,
    return_date: trip.return_date ?? null,
    budget_total: trip.budget_total ?? 0,
    budget_currency: trip.budget_currency ?? 'USD',
    travelers: trip.travelers ?? 1,
    transport_mode: trip.transport_mode ?? null,
    preferences: {},
    user_preferences: userPrefs
      ? {
          dietary: userPrefs.dietary,
          intensity: userPrefs.intensity,
          social: userPrefs.social,
        }
      : undefined,
    selected_flights: (trip.flights ?? []).map((f) => ({
      airline: f.airline ?? '',
      flight_number: f.flight_number ?? '',
      price: f.price ?? 0,
      departure_time: f.departure_time ? f.departure_time.toISOString() : '',
      arrival_time: f.arrival_time ? f.arrival_time.toISOString() : '',
    })),
    selected_hotels: (trip.hotels ?? []).map((h) => ({
      name: h.name ?? '',
      price_per_night: h.price_per_night ?? 0,
      total_price: h.total_price ?? 0,
      star_rating: h.star_rating ?? 0,
    })),
    selected_car_rentals: [],
    selected_experiences: (trip.experiences ?? []).map((e) => ({
      name: e.name ?? '',
      estimated_cost: e.estimated_cost ?? 0,
      category: e.category ?? '',
    })),
    total_spent: 0,
  };

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // Persist user message with typed nodes
  const userNodes: ChatNode[] = [{ type: 'text', content: message }];
  await insertMessage({
    conversation_id: conversation.id,
    role: 'user',
    content: message,
    nodes: userNodes,
  });

  // Fetch enrichment nodes only on the first message (no prior history).
  // Subsequent turns reuse the enrichment already present in the conversation.
  const isFirstMessage = history.length === 0;
  let enrichmentNodes: ChatNode[] = [];
  if (trip.destination && isFirstMessage) {
    try {
      enrichmentNodes = await getEnrichmentNodes(
        trip.destination,
        trip.origin ?? undefined,
      );
    } catch (err) {
      logger.warn({ err, tripId }, 'Failed to fetch enrichment nodes');
    }
  }

  // Inject a trip details form when key fields are missing
  const missingFields: Array<{ name: string; label: string; field_type: 'text' | 'date' | 'number' | 'select'; required: boolean }> = [];
  if (!trip.origin) missingFields.push({ name: 'origin', label: 'Where are you traveling from?', field_type: 'text', required: true });
  if (!trip.departure_date) missingFields.push({ name: 'departure_date', label: 'Departure date', field_type: 'date', required: true });
  if (!trip.return_date) missingFields.push({ name: 'return_date', label: 'Return date', field_type: 'date', required: true });
  if (!trip.budget_total) missingFields.push({ name: 'budget', label: 'Total budget (USD)', field_type: 'number', required: true });
  if (!trip.travelers || trip.travelers <= 1) missingFields.push({ name: 'travelers', label: 'Number of travelers', field_type: 'number', required: true });

  if (missingFields.length > 0 && isFirstMessage) {
    enrichmentNodes.push({
      type: 'travel_plan_form',
      fields: missingFields,
    });
  }

  // Typed SSE event emitter
  const onEvent = (event: SSEEvent) => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  };

  try {
    const result = await runAgentLoop(
      claudeMessages,
      tripContext,
      onEvent,
      conversation.id,
      { tripId, userId },
      enrichmentNodes,
    );

    // Persist assistant message with dual columns (content + tool_calls_json + nodes)
    const assistantMessage = await insertMessage({
      conversation_id: conversation.id,
      role: 'assistant',
      content: result.response,
      tool_calls_json:
        result.tool_calls.length > 0 ? result.tool_calls : undefined,
      nodes: result.nodes,
      token_count: result.total_tokens.input + result.total_tokens.output,
    });

    // Send done event with full ChatMessage
    const chatMessage: ChatMessage = {
      id: assistantMessage.id,
      role: 'assistant',
      nodes: result.nodes,
      sequence: assistantMessage.sequence,
      created_at: assistantMessage.created_at,
    };
    res.write(
      `event: done\ndata: ${JSON.stringify({ type: 'done', message: chatMessage })}\n\n`,
    );
  } catch (err) {
    logger.error({ err, tripId }, 'Agent loop failed');
    res.write(
      `event: error\ndata: ${JSON.stringify({ type: 'error', error: 'Agent encountered an error' })}\n\n`,
    );
  }

  res.end();
}

export async function getMessages(req: Request, res: Response) {
  const tripId = req.params.id as string;
  const conversation = await getOrCreateConversation(tripId);
  const dbMessages = await getMessagesByConversation(conversation.id);

  const messages: ChatMessage[] = dbMessages
    .filter((m) => m.role !== ('tool' as string)) // exclude legacy tool-role messages
    .map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      nodes:
        m.nodes && m.nodes.length > 0
          ? m.nodes
          : [{ type: 'text' as const, content: m.content ?? '' }],
      sequence: m.sequence,
      created_at: m.created_at,
    }));

  res.json({ messages });
}
