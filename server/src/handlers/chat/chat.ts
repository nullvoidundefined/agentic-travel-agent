import type { TripContext } from 'app/prompts/trip-context.js';
import {
  getMessagesByConversation,
  getOrCreateConversation,
  insertMessage,
} from 'app/repositories/conversations/conversations.js';
import { getTripWithDetails } from 'app/repositories/trips/trips.js';
import { findByUserId as findUserPreferences } from 'app/repositories/userPreferences/userPreferences.js';
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

  // Persist user message
  await insertMessage({
    conversation_id: conversation.id,
    role: 'user',
    content: message,
  });

  try {
    const result = await runAgentLoop(
      claudeMessages,
      tripContext,
      (event) => {
        const eventType = event.type;
        res.write(`event: ${eventType}\ndata: ${JSON.stringify(event)}\n\n`);
      },
      conversation.id,
      { tripId, userId },
    );

    // Persist assistant message
    await insertMessage({
      conversation_id: conversation.id,
      role: 'assistant',
      content: result.response,
      tool_calls_json:
        result.tool_calls.length > 0 ? result.tool_calls : undefined,
      token_count: result.total_tokens.input + result.total_tokens.output,
    });

    // Send done event
    res.write(
      `event: done\ndata: ${JSON.stringify({ response: result.response, tool_calls: result.tool_calls })}\n\n`,
    );
  } catch (err) {
    logger.error({ err, tripId }, 'Agent loop failed');
    res.write(
      `event: error\ndata: ${JSON.stringify({ error: 'AI_SERVICE_ERROR', message: 'Agent encountered an error' })}\n\n`,
    );
  }

  res.end();
}

export async function getMessages(req: Request, res: Response) {
  const tripId = req.params.id as string;
  const conversation = await getOrCreateConversation(tripId);
  const messages = await getMessagesByConversation(conversation.id);
  res.json({ messages });
}
