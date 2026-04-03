# Per-Category State Machines Design

**Date:** 2026-04-03
**Status:** Approved
**Scope:** Decompose the booking flow into per-category state machines (flights, hotels, car rental, experiences) with explicit sub-states, persisted in a JSONB column on the conversations table.

---

## Problem

The current single `getBookingStep()` function returns one of 7 flat steps. Within each step, Claude must figure out where it is in the sub-conversation (has the user been asked a question? have results been shown? is the user browsing?) from conversation history alone. This is fragile and leads to Claude re-asking questions, re-describing results, or skipping ahead.

## Decisions

1. **Per-category state machines** — flights, hotels, car_rental, experiences each have their own state: `idle | asking | presented | done | skipped`
2. **State lives on conversations table** — `booking_state` JSONB column. Conversational state, not trip data.
3. **Shared types, bespoke logic** — all categories share `CategoryState` type but each has its own transition rules and prompts
4. **Single coordinator replaces getBookingStep** — `getFlowPosition()` reads trip + booking_state and returns `{ phase, category?, status? }`
5. **Server-side transitions** — the chat handler advances state after each agent loop, not Claude
6. **COLLECT_DETAILS and CONFIRM stay as-is** — they're bookend phases, not browse-and-select flows
7. **skip_category in format_response** — Claude signals user declined a category explicitly

---

## Architecture

### State Shape

```typescript
interface BookingState {
  flights: CategoryState;
  hotels: CategoryState;
  car_rental: CategoryState;
  experiences: CategoryState;
}

type CategoryStatus = 'idle' | 'asking' | 'presented' | 'done' | 'skipped';

interface CategoryState {
  status: CategoryStatus;
  meta?: Record<string, unknown>;
}
```

Default for new conversations:

```json
{
  "flights": { "status": "idle" },
  "hotels": { "status": "idle" },
  "car_rental": { "status": "idle" },
  "experiences": { "status": "idle" }
}
```

The `meta` field stores category-specific context (e.g., `flights.meta.time_preference = 'morning'`).

`skipped` = user declined. `done` = user made a selection.

### Flow Coordinator

```typescript
type FlowPosition =
  | { phase: 'COLLECT_DETAILS' }
  | {
      phase: 'CATEGORY';
      category: 'flights' | 'hotels' | 'car_rental' | 'experiences';
      status: CategoryStatus;
    }
  | { phase: 'CONFIRM' }
  | { phase: 'COMPLETE' };

function getFlowPosition(
  trip: TripState,
  bookingState: BookingState,
): FlowPosition;
```

Logic:

1. Missing required fields (budget, dates, origin) → `COLLECT_DETAILS`
2. `transport_mode` is null → `{ phase: 'CATEGORY', category: 'flights', status: 'idle' }` (flights.idle handles the flying/driving question)
3. `transport_mode === 'driving'` → flights auto-skipped, move to next category
4. Walk categories in order: flights → hotels → car_rental → experiences. Return first that isn't `done` or `skipped`, with its current status.
5. All categories done/skipped and `trip.status === 'planning'` → `CONFIRM`
6. Otherwise → `COMPLETE`

### State Transitions

Transitions happen server-side in the chat handler after the agent loop:

```typescript
function advanceBookingState(
  bookingState: BookingState,
  category: string,
  currentStatus: CategoryStatus,
  agentResult: AgentResult,
  updatedTrip: TripState,
): BookingState;
```

**`idle` → `asking`**: When the coordinator returns a category with status `idle`, the chat handler promotes it to `asking` before running the agent loop. This ensures the prompt matches the `asking` state. The transition happens at the start of the turn, not after.

**`asking` → `presented`**: Server detects a search tool (`search_flights`, `search_hotels`, `search_car_rentals`, `search_experiences`) in `agentResult.tool_calls`.

**`asking` → `skipped`**: Claude sets `format_response.skip_category = true`. Server detects and marks category as skipped.

**`presented` → `done`**: Server detects the trip record gained a new selection (flight/hotel/car/experience added to selection tables) by comparing the pre-loop and post-loop trip state.

**`presented` → `asking`**: Server detects a search tool was called while in `presented` (user requested re-search with different criteria).

### Per-Category Prompts

Each category has prompts keyed by status:

**Flights:**

- `idle`: "Ask: 'Will you be flying or driving?' Call update_trip with transport_mode. Quick replies: ['I'll be flying', 'I'll drive']"
- `asking`: "Ask time of day preference. Then search flights. One sentence."
- `presented`: "User is browsing flights. Answer questions briefly. Do NOT describe results. Wait for selection."

**Hotels:**

- `idle`/`asking` (merged): "Ask: 'Do you need a hotel?' If yes, search. If no, set skip_category."
- `presented`: "User is browsing hotels. Answer briefly. Wait for selection."

**Car Rental:**

- `idle`/`asking` (merged): "Ask: 'Need a rental car?' If yes, search. If no, set skip_category."
- `presented`: "User is browsing cars. Answer briefly. Wait for selection."

**Experiences:**

- `idle`/`asking` (merged): "Suggest categories based on user preferences in one sentence. Search experiences."
- `presented`: "User is browsing experiences. Answer briefly. Wait for selection."

All prompts include shared rules: 1-2 sentences max, never describe search results, format_response required, handle tangent questions briefly and redirect.

### format_response Changes

Add `skip_category` boolean field to the `format_response` tool definition:

```typescript
skip_category: {
  type: 'boolean',
  description: 'Set to true when the user declines the current category (e.g., "No, I don\'t need a hotel"). The system will skip this category and move to the next.',
}
```

### Chat Handler Flow

```
1. Load trip, conversation, history
2. Read conversation.booking_state
3. Compute FlowPosition from trip + bookingState
4. Select prompt based on FlowPosition
5. Run agent loop
6. After agent loop:
   a. Reload trip from DB
   b. Call advanceBookingState() to compute new state
   c. Persist new booking_state to conversation
   d. If COLLECT_DETAILS, inject form for missing fields
   e. Persist assistant message
   f. Send done event
```

### Database

One new column on `conversations` table:

```sql
ALTER TABLE conversations
  ADD COLUMN booking_state JSONB NOT NULL DEFAULT '{"flights":{"status":"idle"},"hotels":{"status":"idle"},"car_rental":{"status":"idle"},"experiences":{"status":"idle"}}';
```

### What Changes

| Component                                                | Change                                                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `server/src/prompts/booking-steps.ts`                    | Rewrite: new types, `getFlowPosition()`, `advanceBookingState()`, per-category prompts |
| `server/src/prompts/booking-steps.test.ts`               | Rewrite: test all transitions and prompts                                              |
| `server/src/prompts/system-prompt.ts`                    | Update: accept `FlowPosition` instead of `BookingStep`                                 |
| `server/src/prompts/system-prompt.test.ts`               | Update tests                                                                           |
| `server/src/handlers/chat/chat.ts`                       | Read/write booking_state, call advanceBookingState after agent loop                    |
| `server/src/handlers/chat/chat.test.ts`                  | Update tests                                                                           |
| `server/src/services/agent.service.ts`                   | Pass FlowPosition instead of BookingStep                                               |
| `server/src/tools/definitions.ts`                        | Add skip_category to format_response                                                   |
| `server/src/repositories/conversations/conversations.ts` | Add booking_state to Conversation interface, add updateBookingState function           |
| `server/migrations/`                                     | New migration for booking_state column                                                 |

### What Doesn't Change

- COLLECT_DETAILS phase (welcome text + form injection)
- CONFIRM / COMPLETE phases
- All frontend components
- Node builder, tool executor, enrichment service
- SSE protocol, streaming
- transport_mode on trips table

### Testing

- Unit tests for `getFlowPosition()` — every combination of trip state + booking state
- Unit tests for `advanceBookingState()` — every transition (idle→asking, asking→presented, asking→skipped, presented→done, presented→asking)
- Unit tests for per-category prompts — each status returns correct instructions
- Integration tests for chat handler — booking_state read/write, state advancement
