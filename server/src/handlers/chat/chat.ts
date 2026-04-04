import type {
  ChatMessage,
  ChatNode,
  SSEEvent,
} from '@agentic-travel-agent/shared-types';
import {
  DEFAULT_COMPLETION_TRACKER,
  computeNudge,
  getFlowPosition,
  hasAnySelection,
  normalizeCompletionTracker,
  updateCompletionTracker,
} from 'app/prompts/booking-steps.js';
import type { TripContext } from 'app/prompts/trip-context.js';
import {
  getMessagesByConversation,
  getOrCreateConversation,
  insertMessage,
  updateBookingState,
} from 'app/repositories/conversations/conversations.js';
import { getTripWithDetails } from 'app/repositories/trips/trips.js';
import { findByUserId as findUserPreferences } from 'app/repositories/userPreferences/userPreferences.js';
import { runAgentLoop } from 'app/services/agent.service.js';
import { getEnrichmentNodes } from 'app/services/enrichment.js';
import { logger } from 'app/utils/logs/logger.js';
import type { Request, Response } from 'express';

// In-memory lock to prevent concurrent agent loops per conversation
const activeConversations = new Set<string>();

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

  if (activeConversations.has(conversation.id)) {
    res.status(409).json({
      error: 'CONFLICT',
      message:
        'A response is already being generated for this trip. Please wait.',
    });
    return;
  }
  activeConversations.add(conversation.id);

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

  // Truncate conversation history to last 20 messages to stay within token limits.
  // Keep the first message (often contains trip context) and the most recent messages.
  const MAX_HISTORY_MESSAGES = 20;
  if (claudeMessages.length > MAX_HISTORY_MESSAGES + 1) {
    // Keep the first message and the most recent 20
    claudeMessages.splice(1, claudeMessages.length - MAX_HISTORY_MESSAGES - 1);
  }

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
          accommodation: userPrefs.accommodation,
          travel_pace: userPrefs.travel_pace,
          dietary: userPrefs.dietary,
          dining_style: userPrefs.dining_style,
          activities: userPrefs.activities,
          travel_party: userPrefs.travel_party,
          budget_comfort: userPrefs.budget_comfort,
          lgbtq_safety: userPrefs.lgbtq_safety ?? false,
          gender: userPrefs.gender ?? null,
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
    selected_car_rentals: (trip.car_rentals ?? []).map((c) => ({
      provider: c.provider,
      car_name: c.car_name,
      car_type: c.car_type,
      price_per_day: c.price_per_day,
      total_price: c.total_price,
    })),
    selected_experiences: (trip.experiences ?? []).map((e) => ({
      name: e.name ?? '',
      estimated_cost: e.estimated_cost ?? 0,
      category: e.category ?? '',
    })),
    total_spent:
      (trip.flights ?? []).reduce((sum, f) => sum + (f.price ?? 0), 0) +
      (trip.hotels ?? []).reduce((sum, h) => sum + (h.total_price ?? 0), 0) +
      (trip.car_rentals ?? []).reduce(
        (sum, c) => sum + (c.total_price ?? 0),
        0,
      ) +
      (trip.experiences ?? []).reduce(
        (sum, e) => sum + (e.estimated_cost ?? 0),
        0,
      ),
  };

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    // Instruct Railway's reverse proxy not to buffer this response
    'X-Accel-Buffering': 'no',
  });
  // Flush the response headers immediately so the browser can start reading
  // the stream without waiting for the first data chunk.
  res.flushHeaders();
  // The global request timeout (30 s) would kill the SSE stream mid-response
  // for any agent loop that takes longer than 30 seconds. Disable it for this
  // long-running SSE endpoint by resetting the socket timeout to 0 (unlimited).
  res.setTimeout(0);
  // Backup safety net: close the connection if the agent loop exceeds 150s
  // (slightly longer than the orchestrator's 120s maxDurationMs)
  req.socket.setTimeout(150_000);

  // Clean up if client disconnects mid-stream
  req.on('close', () => {
    activeConversations.delete(conversation.id);
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
      enrichmentNodes =
        (await getEnrichmentNodes(
          trip.destination,
          trip.origin ?? undefined,
        )) ?? [];
    } catch (err) {
      logger.warn({ err, tripId }, 'Failed to fetch enrichment nodes');
    }
  }

  const hasCriticalAdvisory = enrichmentNodes.some(
    (n) =>
      n.type === 'advisory' && 'severity' in n && n.severity === 'critical',
  );

  // Typed SSE event emitter — flush after every write so each token is sent
  // immediately rather than buffered by Node.js or a reverse proxy.
  const onEvent = (event: SSEEvent) => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    // res.flush() is available when compression middleware is active; calling it
    // defensively here ensures chunks are pushed through any proxy buffering.
    (res as unknown as { flush?: () => void }).flush?.();
  };

  const tracker = normalizeCompletionTracker(
    (conversation as unknown as Record<string, unknown>).booking_state ??
      DEFAULT_COMPLETION_TRACKER,
  );

  const flowPosition = getFlowPosition({
    ...trip,
    origin: trip.origin ?? null,
    departure_date: trip.departure_date ?? null,
    return_date: trip.return_date ?? null,
    budget_total: trip.budget_total ?? null,
    transport_mode: trip.transport_mode ?? null,
    flights: (trip.flights ?? []).map((f) => ({ id: f.id })),
    hotels: (trip.hotels ?? []).map((h) => ({ id: h.id })),
    car_rentals: (trip.car_rentals ?? []).map((c) => ({ id: c.id })),
    experiences: (trip.experiences ?? []).map((e) => ({ id: e.id })),
    status: trip.status ?? 'planning',
  });

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

    // After the agent loop (which may have called update_trip), reload the trip
    // to check if details are still missing. Append form for missing fields only.
    const updatedTrip = await getTripWithDetails(tripId, userId);
    if (updatedTrip) {
      const updatedPosition = getFlowPosition({
        ...updatedTrip,
        origin: updatedTrip.origin ?? null,
        departure_date: updatedTrip.departure_date ?? null,
        return_date: updatedTrip.return_date ?? null,
        budget_total: updatedTrip.budget_total ?? null,
        transport_mode: updatedTrip.transport_mode ?? null,
        flights: (updatedTrip.flights ?? []).map((f) => ({ id: f.id })),
        hotels: (updatedTrip.hotels ?? []).map((h) => ({ id: h.id })),
        car_rentals: (updatedTrip.car_rentals ?? []).map((c) => ({
          id: c.id,
        })),
        experiences: (updatedTrip.experiences ?? []).map((e) => ({
          id: e.id,
        })),
        status: updatedTrip.status ?? 'planning',
      });
      if (updatedPosition.phase === 'COLLECT_DETAILS') {
        const isPlaceholder =
          !updatedTrip.destination || updatedTrip.destination === 'Planning...';
        const missingFields: Array<{
          name: string;
          label: string;
          field_type: 'text' | 'date' | 'number' | 'select';
          required: boolean;
        }> = [];
        if (isPlaceholder)
          missingFields.push({
            name: 'destination',
            label: 'Where do you want to go?',
            field_type: 'text',
            required: true,
          });
        if (!updatedTrip.origin)
          missingFields.push({
            name: 'origin',
            label: 'Where are you traveling from?',
            field_type: 'text',
            required: true,
          });
        if (!updatedTrip.departure_date)
          missingFields.push({
            name: 'departure_date',
            label: 'Departure date',
            field_type: 'date',
            required: true,
          });
        // Only require return_date for round trips
        const isOneWay =
          (updatedTrip as unknown as Record<string, unknown>).trip_type ===
          'one_way';
        if (!isOneWay && !updatedTrip.return_date)
          missingFields.push({
            name: 'return_date',
            label: 'Return date',
            field_type: 'date',
            required: true,
          });
        if (!updatedTrip.budget_total)
          missingFields.push({
            name: 'budget',
            label: 'Total budget in USD (optional)',
            field_type: 'number',
            required: false,
          });
        if (!updatedTrip.travelers || updatedTrip.travelers < 1)
          missingFields.push({
            name: 'travelers',
            label: 'Number of travelers',
            field_type: 'number',
            required: true,
          });

        if (missingFields.length > 0) {
          result.nodes.push({
            type: 'travel_plan_form',
            fields: missingFields,
          });
        }
      }
    }

    // Update completion tracker after the agent loop
    if (updatedTrip) {
      const newTracker = updateCompletionTracker(tracker, result, {
        ...updatedTrip,
        transport_mode: updatedTrip.transport_mode ?? null,
        flights: (updatedTrip.flights ?? []).map((f) => ({ id: f.id })),
        hotels: (updatedTrip.hotels ?? []).map((h) => ({ id: h.id })),
        car_rentals: (updatedTrip.car_rentals ?? []).map((c) => ({
          id: c.id,
        })),
        experiences: (updatedTrip.experiences ?? []).map((e) => ({
          id: e.id,
        })),
        status: updatedTrip.status ?? 'planning',
      });

      // Empty itinerary guard
      if (!hasAnySelection(newTracker)) {
        const allSkippedOrPending = (
          ['flights', 'hotels', 'car_rental', 'experiences'] as const
        ).every((cat) => {
          const status = newTracker[cat];
          return status === 'skipped' || status === 'pending';
        });
        if (allSkippedOrPending) {
          result.nodes.push({
            type: 'text',
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
    (res as unknown as { flush?: () => void }).flush?.();
  } catch (err) {
    logger.error({ err, tripId }, 'Agent loop failed');
    res.write(
      `event: error\ndata: ${JSON.stringify({ type: 'error', error: 'Agent encountered an error' })}\n\n`,
    );
    (res as unknown as { flush?: () => void }).flush?.();
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
    res.status(404).json({ error: 'NOT_FOUND', message: 'Trip not found' });
    return;
  }

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

  // Generate a welcome message on-the-fly for new trips — text only, no form.
  // The form appears in the agent's response after the user replies with partial info.
  if (messages.length === 0) {
    const isPlaceholder =
      !trip.destination || trip.destination === 'Planning...';

    const welcomeText = isPlaceholder
      ? "Hi! I'd love to help plan your trip. Where would you like to go, when are you traveling, and what's your budget?"
      : `Great choice! Let's plan your trip to **${trip.destination}**. When are you traveling, what's your budget, and where will you be coming from?`;
    const welcomeNodes: ChatNode[] = [{ type: 'text', content: welcomeText }];

    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      role: 'assistant',
      nodes: welcomeNodes,
      sequence: 0,
      created_at: new Date().toISOString(),
    };
    messages.unshift(welcomeMessage);
  }

  res.json({ messages });
}
