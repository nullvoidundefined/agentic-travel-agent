# Chat Flow State Machine Design

**Date:** 2026-04-03
**Status:** Approved
**Scope:** Replace monolithic system prompt with state-driven conversational flow, add welcome experience, true token streaming, and auto-advance on tile selection.

---

## Problem

The chat produces walls of text, doesn't show the trip details form reliably, has no typing animation, doesn't show user messages optimistically, and doesn't follow a guided booking flow. Claude sees the entire flow in one prompt and tries to do everything at once.

## Decisions

1. **State-driven prompting** — derive current booking step from the trip record, generate step-specific prompts. Claude only sees its current task.
2. **Server-side welcome** — on first page load with no messages, server auto-generates a welcome message + trip details form without calling Claude.
3. **Hybrid form gate** — form is server-injected, Claude adds one sentence of warmth via narrow step-1 prompt.
4. **User chooses transport mode** — "Flying or driving?" rather than distance-based assumptions.
5. **Auto-advance on selection** — tile confirmation sends a message that triggers the next step.
6. **Brief acknowledgment of preferences** — Claude mentions user preferences when suggesting experiences, one sentence.
7. **Simple summary for confirmation** — markdown summary + budget bar + confirm button, no day-by-day itinerary.
8. **Fail fast on search errors** — no retries, actionable quick replies to adjust criteria.
9. **True token streaming** — switch to `messages.stream()` for character-by-character typing animation. Done last.

---

## Architecture

### Step Detection

A pure function that examines the trip record and returns the current booking step:

```typescript
type BookingStep =
  | 'COLLECT_DETAILS'
  | 'TRANSPORT'
  | 'LODGING'
  | 'CAR_RENTAL'
  | 'EXPERIENCES'
  | 'CONFIRM'
  | 'COMPLETE';

function getBookingStep(trip: TripWithDetails): BookingStep {
  if (
    !trip.budget_total ||
    !trip.departure_date ||
    !trip.return_date ||
    !trip.origin
  )
    return 'COLLECT_DETAILS';
  if (!trip.transport_mode) return 'TRANSPORT';
  if (trip.transport_mode === 'flying' && trip.flights.length === 0)
    return 'TRANSPORT'; // still need to search/select flights
  if (trip.hotels.length === 0) return 'LODGING';
  if (trip.car_rentals?.length === 0) return 'CAR_RENTAL';
  if (trip.experiences.length === 0) return 'EXPERIENCES';
  if (trip.status === 'planning') return 'CONFIRM';
  return 'COMPLETE';
}
```

State is derived entirely from the trip record. One new column: `transport_mode` (`'flying' | 'driving' | null`) on the trips table. When the user chooses flying or driving, Claude calls `update_trip` with `transport_mode`. This allows `getBookingStep()` to skip TRANSPORT once answered and skip flights when driving.

Declined steps (user says "no" to car rental or experiences) are visible in the conversation history — Claude sees the prior "no" and the step-specific prompt says "If the user already declined, move to the next step by calling format_response with a quick_reply suggesting the next category."

### Step-Specific Prompts

Each step gets a focused prompt (5-15 lines). The prompt builder selects the right one based on `getBookingStep()`:

**COLLECT_DETAILS:**

> A form is being shown to collect trip details (dates, budget, origin, travelers). Acknowledge the user's destination in one sentence. Do NOT ask questions — the form handles data collection. Call format_response with brief welcoming text.

**TRANSPORT:**

> Ask the user: "Will you be flying or driving?" If flying, ask what time of day they prefer (morning, afternoon, evening). Then search flights and let the cards speak. If driving, acknowledge and call format_response to move on. Keep text to one sentence.

**LODGING:**

> Ask: "Do you need a hotel?" If yes, search hotels. The hotel cards show the results. Keep text to one sentence. If no, acknowledge and move on.

**CAR_RENTAL:**

> Ask: "Will you need a rental car?" If yes, search car rentals. The car cards show results. Keep text to one sentence. If the user already declined in conversation history, skip to suggesting experiences.

**EXPERIENCES:**

> Based on the user's preferences (dietary: {dietary}, intensity: {intensity}, social: {social}), suggest relevant experience categories in one sentence. Search experiences. The experience cards show results. Briefly acknowledge their preferences.

**CONFIRM:**

> Summarize the trip: destination, dates, flight, hotel, car rental (if any), experiences (if any), total cost. Ask: "Ready to book?" Provide quick_replies: ["Confirm booking", "Make changes"].

**COMPLETE:**

> The trip is booked. Answer any follow-up questions about the trip.

Each prompt also includes the shared rules:

- Keep text to 1-2 sentences max
- Never describe search results in text — the cards handle it
- Never use numbered lists
- If the user asks a travel-related question, answer briefly and redirect: "Now, back to [current task]"
- Always call format_response as your last tool call
- Call update_trip immediately when the user provides trip details

### Welcome Flow (Server-Side)

When a user opens a trip page with no messages in the conversation:

1. Server detects `history.length === 0`
2. Server creates an assistant message with nodes:
   - `{ type: 'text', content: "Let's plan your trip to {destination}!" }`
   - `{ type: 'travel_plan_form', fields: [missing fields] }` (if fields are missing)
3. This message is persisted to the database
4. No Claude API call is made
5. The frontend renders the welcome message + form on page load

The form submission constructs a natural language message ("I'm traveling from NYC, June 1-10, $5000 budget, 2 travelers") and sends it as a user message. This triggers the first real agent turn, which uses the TRANSPORT step prompt (since details are now filled).

### Auto-Advance on Selection

When a user confirms a selection on a tile (flight, hotel, car, experience):

1. `SelectableCardGroup.onConfirm` fires with the selected item's label
2. The ChatBox sends a message like "I've selected [Alaska Airlines AS 21]"
3. This triggers a new agent turn via POST /trips/:id/chat
4. The trip record now has the selection (persisted by the tool during the prior turn)
5. `getBookingStep()` returns the next step
6. Claude gets the next step's prompt and asks the next question

### True Token Streaming

Switch `AgentOrchestrator.run()` from `messages.create()` to `messages.stream()`:

1. Start stream: `client.messages.stream({ model, system, tools, messages })`
2. Listen for events:
   - `text` event → emit `text_delta` SSE event with the token
   - `contentBlock` event with type `tool_use` → accumulate tool use block
3. On stream end:
   - If stop_reason is `end_turn`, return result
   - If stop_reason is `tool_use`, execute tools, continue loop with new stream
4. The tool execution loop stays the same — only the API call changes

The frontend already handles incremental `text_delta` events via `useSSEChat`. No frontend changes needed for streaming.

### Error Recovery

When a search tool fails:

1. The tool executor catches the error and returns an error message
2. Claude sees the error in the tool result
3. The step-specific prompt says: "If a search fails, tell the user briefly and offer quick_replies to adjust criteria (dates, budget, destination)"
4. The step does NOT advance — `getBookingStep()` still returns the same step since no selection was made

### What Changes

| File                                            | Change                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `server/src/prompts/system-prompt.ts`           | Replace monolithic prompt with step-specific prompt builder         |
| `server/src/prompts/booking-steps.ts`           | NEW: step detection + per-step prompt templates                     |
| `server/src/handlers/chat/chat.ts`              | Add welcome message generation, pass booking step to prompt builder |
| `server/src/services/AgentOrchestrator.ts`      | Switch to messages.stream() for token streaming                     |
| `web-client/src/components/ChatBox/ChatBox.tsx` | Handle welcome message on first load                                |

### Database

One new column: `transport_mode VARCHAR(10)` on the `trips` table. Migration adds it as nullable, no backfill needed.

The `update_trip` tool definition and executor need to accept `transport_mode` as an optional field.

### What Doesn't Change

- ChatNode types, NodeRenderer, all tile/card components
- SSE event types and protocol
- useSSEChat hook (already handles incremental text_delta)
- VirtualizedChat (already renders streaming messages)
- Node builder, tool definitions, tool executor
- TripDetailsForm component

### Testing

- Unit tests for `getBookingStep()` — verify correct step for each trip state
- Unit tests for each step-specific prompt — verify content contains expected instructions
- Integration test for welcome message generation — verify nodes are correct
- Integration test for the chat handler with step-driven prompt
- Existing tests updated where system prompt expectations changed
