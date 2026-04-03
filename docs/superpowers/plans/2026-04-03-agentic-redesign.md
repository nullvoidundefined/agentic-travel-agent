# Agentic Chat Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-category state machine with a completion tracker and single system prompt that gives Claude genuine planning agency, while keeping server-side guardrails. Expand destinations from 30 to 34.

**Architecture:** The completion tracker replaces BookingState with simpler statuses (pending/searching/selected/skipped). A single rich system prompt replaces 12 micro-prompts — Claude sees a checklist and decides what to do. The server updates the tracker after each turn by inspecting tool calls, and injects nudges when progress stalls.

**Tech Stack:** Express 5, TypeScript, Vitest, Next.js 15

**Verification before every commit:** `pnpm format:check && pnpm lint && pnpm test && pnpm build`

---

## File Structure

### Modified Files

```
server/src/prompts/booking-steps.ts            # CompletionTracker replaces BookingState, simplified FlowPosition
server/src/prompts/booking-steps.test.ts        # Tests rewritten for CompletionTracker
server/src/prompts/system-prompt.ts             # Single prompt replaces category-prompt dispatch
server/src/prompts/system-prompt.test.ts        # Tests rewritten for single prompt
server/src/prompts/category-prompts.ts          # Gutted — exports removed, file kept empty or deleted
server/src/prompts/category-prompts.test.ts     # Tests removed or replaced
server/src/prompts/trip-context.ts              # Add formatChecklist() function
server/src/tools/definitions.ts                 # skip_category: boolean → string
server/src/handlers/chat/chat.ts                # Simplified — no state machine orchestration
server/src/handlers/chat/chat.test.ts           # Tests updated for new flow
server/src/services/agent.service.ts            # Pass completion tracker to prompt builder
web-client/src/data/destinations.ts             # 4 new destination entries
web-client/src/lib/destinationImage.ts          # 3 new Unsplash image IDs
```

---

## Task 1: CompletionTracker — Types, Normalizer, and Flow Position

**Files:**

- Modify: `server/src/prompts/booking-steps.ts`
- Modify: `server/src/prompts/booking-steps.test.ts`

This task replaces `BookingState` with `CompletionTracker`, rewrites `normalizeBookingState` → `normalizeCompletionTracker` with v1→v2 migration, simplifies `FlowPosition` to 3 phases, and replaces `advanceBookingState` with `updateCompletionTracker`.

- [ ] **Step 1: Write failing tests for the new CompletionTracker**

Replace the entire content of `server/src/prompts/booking-steps.test.ts` with:

```typescript
import { describe, expect, it } from 'vitest';

import {
  type CompletionTracker,
  DEFAULT_COMPLETION_TRACKER,
  type TripState,
  getFlowPosition,
  normalizeCompletionTracker,
  updateCompletionTracker,
} from './booking-steps.js';

const baseTripState: TripState = {
  destination: 'Paris',
  origin: 'JFK',
  departure_date: '2026-06-01',
  return_date: '2026-06-10',
  budget_total: 5000,
  transport_mode: 'flying',
  flights: [],
  hotels: [],
  experiences: [],
  status: 'planning',
};

describe('normalizeCompletionTracker', () => {
  it('should return defaults for null input', () => {
    const result = normalizeCompletionTracker(null);
    expect(result).toEqual(DEFAULT_COMPLETION_TRACKER);
  });

  it('should return defaults for undefined input', () => {
    const result = normalizeCompletionTracker(undefined);
    expect(result).toEqual(DEFAULT_COMPLETION_TRACKER);
  });

  it('should migrate v1 BookingState to v2 CompletionTracker', () => {
    const v1 = {
      version: 1,
      flights: { status: 'idle' },
      hotels: { status: 'asking' },
      car_rental: { status: 'presented' },
      experiences: { status: 'done' },
    };
    const result = normalizeCompletionTracker(v1);
    expect(result.version).toBe(2);
    expect(result.flights).toBe('pending');
    expect(result.hotels).toBe('pending');
    expect(result.car_rental).toBe('searching');
    expect(result.experiences).toBe('selected');
    expect(result.turns_since_last_progress).toBe(0);
  });

  it('should migrate v1 skipped status', () => {
    const v1 = {
      version: 1,
      flights: { status: 'skipped' },
      hotels: { status: 'idle' },
      car_rental: { status: 'idle' },
      experiences: { status: 'idle' },
    };
    const result = normalizeCompletionTracker(v1);
    expect(result.flights).toBe('skipped');
  });

  it('should pass through valid v2 data', () => {
    const v2: CompletionTracker = {
      version: 2,
      transport: 'flying',
      flights: 'selected',
      hotels: 'searching',
      car_rental: 'pending',
      experiences: 'pending',
      turns_since_last_progress: 2,
    };
    const result = normalizeCompletionTracker(v2);
    expect(result).toEqual(v2);
  });

  it('should fill missing fields in v2 data', () => {
    const partial = { version: 2, flights: 'selected' };
    const result = normalizeCompletionTracker(partial);
    expect(result.flights).toBe('selected');
    expect(result.hotels).toBe('pending');
    expect(result.transport).toBe('pending');
    expect(result.turns_since_last_progress).toBe(0);
  });
});

describe('getFlowPosition', () => {
  it('should return COMPLETE when trip status is not planning', () => {
    const trip = { ...baseTripState, status: 'saved' };
    const result = getFlowPosition(trip);
    expect(result.phase).toBe('COMPLETE');
  });

  it('should return COLLECT_DETAILS when origin is missing', () => {
    const trip = { ...baseTripState, origin: null };
    const result = getFlowPosition(trip);
    expect(result.phase).toBe('COLLECT_DETAILS');
  });

  it('should return COLLECT_DETAILS when departure_date is missing', () => {
    const trip = { ...baseTripState, departure_date: null };
    const result = getFlowPosition(trip);
    expect(result.phase).toBe('COLLECT_DETAILS');
  });

  it('should return PLANNING when all required fields are present', () => {
    const result = getFlowPosition(baseTripState);
    expect(result.phase).toBe('PLANNING');
  });

  it('should allow null return_date for one_way trips', () => {
    const trip = {
      ...baseTripState,
      return_date: null,
      trip_type: 'one_way' as const,
    };
    const result = getFlowPosition(trip);
    expect(result.phase).toBe('PLANNING');
  });

  it('should require return_date for round trips', () => {
    const trip = { ...baseTripState, return_date: null };
    const result = getFlowPosition(trip);
    expect(result.phase).toBe('COLLECT_DETAILS');
  });

  it('should not require budget for PLANNING', () => {
    const trip = { ...baseTripState, budget_total: null };
    const result = getFlowPosition(trip);
    expect(result.phase).toBe('PLANNING');
  });
});

describe('updateCompletionTracker', () => {
  it('should mark category as searching when search tool is called', () => {
    const tracker = { ...DEFAULT_COMPLETION_TRACKER };
    const result = updateCompletionTracker(
      tracker,
      {
        tool_calls: [{ tool_name: 'search_flights' }],
        formatResponse: null,
      },
      baseTripState,
    );
    expect(result.flights).toBe('searching');
    expect(result.turns_since_last_progress).toBe(0);
  });

  it('should mark category as selected when trip has selections', () => {
    const tracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      flights: 'searching' as const,
    };
    const tripWithFlight = { ...baseTripState, flights: [{ id: '1' }] };
    const result = updateCompletionTracker(
      tracker,
      {
        tool_calls: [{ tool_name: 'select_flight' }],
        formatResponse: null,
      },
      tripWithFlight,
    );
    expect(result.flights).toBe('selected');
  });

  it('should mark category as skipped when skip_category names it', () => {
    const tracker = { ...DEFAULT_COMPLETION_TRACKER };
    const result = updateCompletionTracker(
      tracker,
      {
        tool_calls: [],
        formatResponse: { skip_category: 'hotels' },
      },
      baseTripState,
    );
    expect(result.hotels).toBe('skipped');
  });

  it('should update transport when update_trip sets transport_mode', () => {
    const tracker = { ...DEFAULT_COMPLETION_TRACKER };
    const tripDriving = {
      ...baseTripState,
      transport_mode: 'driving' as const,
    };
    const result = updateCompletionTracker(
      tracker,
      {
        tool_calls: [{ tool_name: 'update_trip' }],
        formatResponse: null,
      },
      tripDriving,
    );
    expect(result.transport).toBe('driving');
    expect(result.flights).toBe('skipped');
  });

  it('should increment turns_since_last_progress when no status changes', () => {
    const tracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      turns_since_last_progress: 1,
    };
    const result = updateCompletionTracker(
      tracker,
      {
        tool_calls: [],
        formatResponse: null,
      },
      baseTripState,
    );
    expect(result.turns_since_last_progress).toBe(2);
  });

  it('should reset turns_since_last_progress when any status changes', () => {
    const tracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      turns_since_last_progress: 5,
    };
    const result = updateCompletionTracker(
      tracker,
      {
        tool_calls: [{ tool_name: 'search_hotels' }],
        formatResponse: null,
      },
      baseTripState,
    );
    expect(result.turns_since_last_progress).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/prompts/booking-steps.test.ts`
Expected: FAIL — CompletionTracker, DEFAULT_COMPLETION_TRACKER, updateCompletionTracker don't exist yet

- [ ] **Step 3: Rewrite booking-steps.ts**

Replace the entire content of `server/src/prompts/booking-steps.ts` with:

```typescript
// --- Types ---

export type CategoryName = 'flights' | 'hotels' | 'car_rental' | 'experiences';

export type TrackerStatus = 'pending' | 'searching' | 'selected' | 'skipped';

export interface CompletionTracker {
  version: number;
  transport: 'pending' | 'flying' | 'driving';
  flights: TrackerStatus;
  hotels: TrackerStatus;
  car_rental: TrackerStatus;
  experiences: TrackerStatus;
  turns_since_last_progress: number;
}

export const CURRENT_TRACKER_VERSION = 2;

export const DEFAULT_COMPLETION_TRACKER: CompletionTracker = {
  version: CURRENT_TRACKER_VERSION,
  transport: 'pending',
  flights: 'pending',
  hotels: 'pending',
  car_rental: 'pending',
  experiences: 'pending',
  turns_since_last_progress: 0,
};

// --- Kept for backward compatibility in other files ---

export const SEARCH_TOOLS: Record<CategoryName, string> = {
  flights: 'search_flights',
  hotels: 'search_hotels',
  car_rental: 'search_car_rentals',
  experiences: 'search_experiences',
};

export const SELECTION_KEYS: Record<
  CategoryName,
  'flights' | 'hotels' | 'car_rentals' | 'experiences'
> = {
  flights: 'flights',
  hotels: 'hotels',
  car_rental: 'car_rentals',
  experiences: 'experiences',
};

const SELECT_TOOLS: Record<string, CategoryName> = {
  select_flight: 'flights',
  select_hotel: 'hotels',
  select_car_rental: 'car_rental',
  select_experience: 'experiences',
};

// --- v1 → v2 migration helpers ---

const V1_STATUS_MAP: Record<string, TrackerStatus> = {
  idle: 'pending',
  asking: 'pending',
  presented: 'searching',
  done: 'selected',
  skipped: 'skipped',
};

function migrateV1Status(v1Category: unknown): TrackerStatus {
  if (typeof v1Category === 'object' && v1Category !== null) {
    const status = (v1Category as Record<string, unknown>).status;
    if (typeof status === 'string' && status in V1_STATUS_MAP) {
      return V1_STATUS_MAP[status];
    }
  }
  return 'pending';
}

// --- Normalization ---

const VALID_TRACKER_STATUSES: TrackerStatus[] = [
  'pending',
  'searching',
  'selected',
  'skipped',
];

const VALID_TRANSPORT = ['pending', 'flying', 'driving'];

export function normalizeCompletionTracker(raw: unknown): CompletionTracker {
  if (raw === null || raw === undefined) {
    return { ...DEFAULT_COMPLETION_TRACKER };
  }

  const obj = raw as Record<string, unknown>;

  // v1 migration: BookingState with { status: 'idle' } objects
  if (!('version' in obj) || (obj.version as number) < 2) {
    return {
      version: CURRENT_TRACKER_VERSION,
      transport: 'pending',
      flights: migrateV1Status(obj.flights),
      hotels: migrateV1Status(obj.hotels),
      car_rental: migrateV1Status(obj.car_rental),
      experiences: migrateV1Status(obj.experiences),
      turns_since_last_progress: 0,
    };
  }

  // v2: current format — fill missing fields
  const validStatus = (val: unknown): TrackerStatus =>
    typeof val === 'string' &&
    VALID_TRACKER_STATUSES.includes(val as TrackerStatus)
      ? (val as TrackerStatus)
      : 'pending';

  return {
    version: CURRENT_TRACKER_VERSION,
    transport: VALID_TRANSPORT.includes(obj.transport as string)
      ? (obj.transport as CompletionTracker['transport'])
      : 'pending',
    flights: validStatus(obj.flights),
    hotels: validStatus(obj.hotels),
    car_rental: validStatus(obj.car_rental),
    experiences: validStatus(obj.experiences),
    turns_since_last_progress:
      typeof obj.turns_since_last_progress === 'number'
        ? obj.turns_since_last_progress
        : 0,
  };
}

// --- Flow position ---

export type FlowPosition =
  | { phase: 'COLLECT_DETAILS' }
  | { phase: 'PLANNING' }
  | { phase: 'COMPLETE' };

export interface TripState {
  destination: string;
  origin: string | null;
  departure_date: string | null;
  return_date: string | null;
  budget_total: number | null;
  transport_mode: 'flying' | 'driving' | null;
  trip_type?: 'round_trip' | 'one_way';
  flights: Array<{ id: string }>;
  hotels: Array<{ id: string }>;
  car_rentals?: Array<{ id: string }>;
  experiences: Array<{ id: string }>;
  status: string;
}

export function getFlowPosition(trip: TripState): FlowPosition {
  if (trip.status !== 'planning') {
    return { phase: 'COMPLETE' };
  }

  const needsReturnDate = trip.trip_type !== 'one_way';
  if (
    trip.departure_date === null ||
    (needsReturnDate && trip.return_date === null) ||
    trip.origin === null
  ) {
    return { phase: 'COLLECT_DETAILS' };
  }

  return { phase: 'PLANNING' };
}

// --- Tracker update ---

interface AgentResultForTracker {
  tool_calls: Array<{ tool_name: string }>;
  formatResponse?: { skip_category?: CategoryName | boolean } | null;
}

const CATEGORIES: CategoryName[] = [
  'flights',
  'hotels',
  'car_rental',
  'experiences',
];

export function updateCompletionTracker(
  tracker: CompletionTracker,
  agentResult: AgentResultForTracker,
  updatedTrip: TripState,
): CompletionTracker {
  const newTracker = { ...tracker };
  let changed = false;

  // 1. Transport mode
  if (updatedTrip.transport_mode && newTracker.transport === 'pending') {
    newTracker.transport = updatedTrip.transport_mode;
    changed = true;
    if (
      updatedTrip.transport_mode === 'driving' &&
      newTracker.flights === 'pending'
    ) {
      newTracker.flights = 'skipped';
    }
  }

  // 2. Search tools → searching
  for (const cat of CATEGORIES) {
    const searchTool = SEARCH_TOOLS[cat];
    if (agentResult.tool_calls.some((tc) => tc.tool_name === searchTool)) {
      if (newTracker[cat] !== 'selected') {
        newTracker[cat] = 'searching';
        changed = true;
      }
    }
  }

  // 3. Select tools + trip record → selected
  for (const [toolName, cat] of Object.entries(SELECT_TOOLS)) {
    if (agentResult.tool_calls.some((tc) => tc.tool_name === toolName)) {
      const selKey = SELECTION_KEYS[cat];
      const selections =
        selKey === 'car_rentals'
          ? (updatedTrip.car_rentals ?? [])
          : updatedTrip[selKey];
      if (selections.length > 0) {
        newTracker[cat] = 'selected';
        changed = true;
      }
    }
  }

  // 4. Ground truth: trip record selections override tracker
  for (const cat of CATEGORIES) {
    const selKey = SELECTION_KEYS[cat];
    const selections =
      selKey === 'car_rentals'
        ? (updatedTrip.car_rentals ?? [])
        : updatedTrip[selKey];
    if (selections.length > 0 && newTracker[cat] !== 'selected') {
      newTracker[cat] = 'selected';
      changed = true;
    }
  }

  // 5. skip_category
  const skipCat = agentResult.formatResponse?.skip_category;
  if (
    typeof skipCat === 'string' &&
    CATEGORIES.includes(skipCat as CategoryName)
  ) {
    newTracker[skipCat as CategoryName] = 'skipped';
    changed = true;
  }

  // 6. Progress counter
  if (changed) {
    newTracker.turns_since_last_progress = 0;
  } else {
    newTracker.turns_since_last_progress =
      tracker.turns_since_last_progress + 1;
  }

  return newTracker;
}

// --- Nudge computation ---

export function computeNudge(tracker: CompletionTracker): string | null {
  if (tracker.turns_since_last_progress < 3) return null;

  const pending: string[] = [];
  for (const cat of CATEGORIES) {
    if (tracker[cat] === 'pending') {
      pending.push(cat.replace('_', ' '));
    }
  }

  if (pending.length === 0) return null;

  return `Note: you haven't discussed ${pending.join(', ')} with the user yet. Find a natural moment to bring this up.`;
}

// --- Empty itinerary check ---

export function hasAnySelection(tracker: CompletionTracker): boolean {
  return CATEGORIES.some((cat) => tracker[cat] === 'selected');
}

export function allCategoriesResolved(tracker: CompletionTracker): boolean {
  return CATEGORIES.every(
    (cat) => tracker[cat] === 'selected' || tracker[cat] === 'skipped',
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run src/prompts/booking-steps.test.ts`
Expected: PASS

- [ ] **Step 5: Verify full chain**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`
Expected: FAIL — other files still import old names. That's OK — we'll fix them in subsequent tasks.

If the build fails because other files reference removed exports (`BookingState`, `advanceBookingState`, `DEFAULT_BOOKING_STATE`, `normalizeBookingState`, `CategoryStatus`, `CATEGORY_ORDER`), add temporary re-exports at the bottom of booking-steps.ts:

```typescript
// --- Temporary backward-compat exports (removed in Task 4) ---
export type CategoryStatus = TrackerStatus;
export type BookingState = CompletionTracker;
export const CURRENT_BOOKING_STATE_VERSION = CURRENT_TRACKER_VERSION;
export const DEFAULT_BOOKING_STATE = DEFAULT_COMPLETION_TRACKER;
export const normalizeBookingState = normalizeCompletionTracker;
export const CATEGORY_ORDER: CategoryName[] = [
  'flights',
  'hotels',
  'car_rental',
  'experiences',
];
export function advanceBookingState(
  bookingState: CompletionTracker,
  _category: CategoryName | string,
  _currentStatus: TrackerStatus,
  agentResult: AgentResultForTracker,
  updatedTrip: TripState,
): CompletionTracker {
  return updateCompletionTracker(bookingState, agentResult, updatedTrip);
}
```

- [ ] **Step 6: Run full chain again**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`
Expected: PASS (with backward-compat exports)

- [ ] **Step 7: Commit**

```bash
git add server/src/prompts/booking-steps.ts server/src/prompts/booking-steps.test.ts
git commit -m "feat: replace BookingState with CompletionTracker, simplify FlowPosition to 3 phases"
```

---

## Task 2: Single System Prompt

**Files:**

- Modify: `server/src/prompts/system-prompt.ts`
- Modify: `server/src/prompts/system-prompt.test.ts`
- Modify: `server/src/prompts/trip-context.ts`

- [ ] **Step 1: Add formatChecklist to trip-context.ts**

Add this function to `server/src/prompts/trip-context.ts` after the existing `formatTripContext`:

```typescript
import type { CompletionTracker } from './booking-steps.js';

export function formatChecklist(
  tracker: CompletionTracker,
  ctx: TripContext,
): string {
  const icon = (status: string) =>
    status === 'selected' ? '✅' : status === 'skipped' ? '⏭️' : '⬜';

  const lines: string[] = ['## Trip Planning Checklist'];

  // Transport
  if (tracker.transport === 'pending') {
    lines.push('- ⬜ Transportation: Not yet decided (flying or driving?)');
  } else {
    lines.push(
      `- ✅ Transportation: ${tracker.transport === 'flying' ? 'Flying' : 'Driving'}`,
    );
  }

  // Flights
  if (tracker.flights === 'selected' && ctx.selected_flights.length > 0) {
    const f = ctx.selected_flights[0];
    lines.push(`- ✅ Flights: ${f.airline} ${f.flight_number} — $${f.price}`);
  } else {
    lines.push(
      `- ${icon(tracker.flights)} Flights: ${tracker.flights === 'skipped' ? 'Skipped' : tracker.flights === 'searching' ? 'Browsing options' : 'Not yet discussed'}`,
    );
  }

  // Hotels
  if (tracker.hotels === 'selected' && ctx.selected_hotels.length > 0) {
    const h = ctx.selected_hotels[0];
    lines.push(`- ✅ Hotels: ${h.name} — $${h.total_price} total`);
  } else {
    lines.push(
      `- ${icon(tracker.hotels)} Hotels: ${tracker.hotels === 'skipped' ? 'Skipped' : tracker.hotels === 'searching' ? 'Browsing options' : 'Not yet discussed'}`,
    );
  }

  // Car rental
  if (
    tracker.car_rental === 'selected' &&
    ctx.selected_car_rentals.length > 0
  ) {
    const c = ctx.selected_car_rentals[0];
    lines.push(
      `- ✅ Car Rental: ${c.car_name} from ${c.provider} — $${c.total_price}`,
    );
  } else {
    lines.push(
      `- ${icon(tracker.car_rental)} Car Rental: ${tracker.car_rental === 'skipped' ? 'Skipped' : tracker.car_rental === 'searching' ? 'Browsing options' : 'Not yet discussed'}`,
    );
  }

  // Experiences
  if (
    tracker.experiences === 'selected' &&
    ctx.selected_experiences.length > 0
  ) {
    lines.push(
      `- ✅ Experiences: ${ctx.selected_experiences.length} selected ($${ctx.selected_experiences.reduce((s, e) => s + e.estimated_cost, 0)} total)`,
    );
  } else {
    lines.push(
      `- ${icon(tracker.experiences)} Experiences: ${tracker.experiences === 'skipped' ? 'Skipped' : tracker.experiences === 'searching' ? 'Browsing options' : 'Not yet discussed'}`,
    );
  }

  // Budget
  if (ctx.budget_total > 0) {
    const remaining = ctx.budget_total - ctx.total_spent;
    lines.push(
      `- Budget: $${remaining.toFixed(0)} remaining of $${ctx.budget_total}`,
    );
  }

  lines.push(
    '\nAll categories must be addressed (selected or explicitly skipped) before the trip can be confirmed.',
  );

  return lines.join('\n');
}
```

Also add the import at the top of trip-context.ts.

- [ ] **Step 2: Rewrite system-prompt.ts with single prompt**

Replace the entire content of `server/src/prompts/system-prompt.ts`:

```typescript
import type { CompletionTracker, FlowPosition } from './booking-steps.js';
import {
  type TripContext,
  formatChecklist,
  formatTripContext,
} from './trip-context.js';

const ROLE = `You are Voyager, an expert travel planning advisor. You help users plan trips by searching for flights, hotels, car rentals, and experiences that match their preferences and budget. You're knowledgeable, enthusiastic when you have something genuinely useful to share, and concise when the situation is transactional. You're a real advisor — you make recommendations, explain trade-offs, and share relevant local knowledge.`;

const RESPONSE_GUIDELINES = `## Response Guidelines
- Keep responses under ~100 words. Be concise for transactional exchanges (presenting search results, confirming selections). Be more detailed when advising (recommending a neighborhood, warning about weather, explaining a budget trade-off).
- Never restate what the UI cards already show — the user can see them.
- Never fabricate options or availability.`;

const TOOLS_GUIDE = `## Tools
- **search_flights** — Search for flight options. Use when the user wants to explore flights or you're proactively helping them find transportation. Requires IATA codes (call get_destination_info first if you only have a city name).
- **search_hotels** — Search for hotel options. Use when the user wants lodging. For one-way trips without a return date, ask how many nights before searching.
- **search_car_rentals** — Search for rental car options. Use when the user wants a car at their destination.
- **search_experiences** — Search for activities and dining. Use when the user wants to explore things to do. Consider their activity preferences and weather forecast.
- **get_destination_info** — Look up IATA codes, timezone, currency, best travel times for a destination.
- **update_trip** — Save trip details (destination, dates, origin, budget, transport_mode, trip_type). Call this when the user provides or updates any of these details.
- **select_flight / select_hotel / select_car_rental / select_experience** — Save the user's selection to the trip. Call when the user chooses a specific option.
- **calculate_remaining_budget** — Check how much budget is left after selections. Call after selections to inform the user about budget impact.
- **format_response** — REQUIRED as your last tool call every turn. Provides your text response, optional citations, quick reply suggestions, and advisory escalation. When the user declines a category (e.g., "No, I don't need a car"), set skip_category to the category name (e.g., "car_rental").`;

const GUARDRAILS = `## Guardrails
- If the user asks something unrelated to travel planning, answer briefly if it's harmless, then steer back to the trip. For illegal or harmful requests, decline: "I can't help with that. Let's focus on planning your trip."
- If the user asks about multi-city or multi-destination trips, explain that each trip covers one destination and suggest creating a separate trip for each leg.
- If the user wants to change their destination after bookings have started, warn them that changing will clear all current selections and ask for confirmation before calling update_trip.
- Review travel advisories in context. If they mention health risks (vaccinations, malaria zones, water safety), proactively mention these early — don't wait for the user to ask.
- After each selection, call calculate_remaining_budget. If remaining is negative, tell the user how much they're over budget and ask if they want cheaper options or to continue. Never refuse to book — the user decides.
- If search results are empty or all options far exceed the budget, explain honestly why and suggest realistic alternatives. Never fabricate options.
- When the user explicitly names a specific option, honor that selection. Do not present alternatives unless asked.`;

const COLLECT_DETAILS_ADDENDUM = `\n\n## Current Phase: Collecting Details
A form is being shown to collect trip details. Acknowledge the destination in one friendly sentence. Do NOT ask questions — the form handles data collection.`;

const COMPLETE_ADDENDUM = `\n\n## Current Phase: Trip Booked
The trip is booked. Answer follow-up questions about the trip.`;

export interface PromptOptions {
  hasCriticalAdvisory?: boolean;
  nudge?: string | null;
}

export function buildSystemPrompt(
  tripContext?: TripContext,
  flowPosition?: FlowPosition,
  options?: PromptOptions,
  tracker?: CompletionTracker,
): string {
  const parts = [
    ROLE,
    '\n\n',
    RESPONSE_GUIDELINES,
    '\n\n',
    TOOLS_GUIDE,
    '\n\n',
    GUARDRAILS,
  ];

  // Phase-specific addendum
  if (!flowPosition || flowPosition.phase === 'COLLECT_DETAILS') {
    parts.push(COLLECT_DETAILS_ADDENDUM);
  } else if (flowPosition.phase === 'COMPLETE') {
    parts.push(COMPLETE_ADDENDUM);
  }

  // Current date
  parts.push(
    `\n\n## Current Date\n\nToday is ${new Date().toISOString().split('T')[0]}.`,
  );

  // Critical advisory
  if (options?.hasCriticalAdvisory) {
    parts.push(`\n\n## CRITICAL TRAVEL ADVISORY
A critical travel advisory is in effect for this destination. Before proceeding with any bookings, you MUST acknowledge the advisory and ask the user: "The US State Department advises against all travel to this destination. Are you sure you want to continue planning, or would you prefer a different destination?" Do not proceed to category bookings until the user explicitly confirms.`);
  }

  // Server nudge
  if (options?.nudge) {
    parts.push(`\n\n## Planning Reminder\n${options.nudge}`);
  }

  // Trip checklist
  if (tracker && tripContext && flowPosition?.phase === 'PLANNING') {
    parts.push(`\n\n${formatChecklist(tracker, tripContext)}`);
  }

  // Trip context (preferences, selections, budget)
  if (tripContext) {
    parts.push(
      `\n\n## Current Trip State\n\n${formatTripContext(tripContext)}`,
    );
  }

  return parts.join('');
}
```

- [ ] **Step 3: Rewrite system-prompt tests**

Replace `server/src/prompts/system-prompt.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { DEFAULT_COMPLETION_TRACKER } from './booking-steps.js';
import { buildSystemPrompt } from './system-prompt.js';

describe('buildSystemPrompt', () => {
  it('should include role and guidelines in every prompt', () => {
    const result = buildSystemPrompt();
    expect(result).toContain('Voyager');
    expect(result).toContain('Response Guidelines');
    expect(result).toContain('Tools');
    expect(result).toContain('Guardrails');
  });

  it('should include COLLECT_DETAILS addendum when no flow position', () => {
    const result = buildSystemPrompt();
    expect(result).toContain('Collecting Details');
    expect(result).toContain('form handles data collection');
  });

  it('should include COLLECT_DETAILS addendum for that phase', () => {
    const result = buildSystemPrompt(undefined, { phase: 'COLLECT_DETAILS' });
    expect(result).toContain('Collecting Details');
  });

  it('should include COMPLETE addendum for that phase', () => {
    const result = buildSystemPrompt(undefined, { phase: 'COMPLETE' });
    expect(result).toContain('Trip Booked');
  });

  it('should not include phase addendum for PLANNING', () => {
    const result = buildSystemPrompt(undefined, { phase: 'PLANNING' });
    expect(result).not.toContain('Collecting Details');
    expect(result).not.toContain('Trip Booked');
  });

  it('should include critical advisory when flag is set', () => {
    const result = buildSystemPrompt(undefined, undefined, {
      hasCriticalAdvisory: true,
    });
    expect(result).toContain('CRITICAL TRAVEL ADVISORY');
  });

  it('should not include critical advisory by default', () => {
    const result = buildSystemPrompt();
    expect(result).not.toContain('CRITICAL TRAVEL ADVISORY');
  });

  it('should include nudge when provided', () => {
    const result = buildSystemPrompt(
      undefined,
      { phase: 'PLANNING' },
      {
        nudge: "Note: you haven't discussed hotels yet.",
      },
    );
    expect(result).toContain('Planning Reminder');
    expect(result).toContain('hotels');
  });

  it('should include checklist during PLANNING phase with tracker', () => {
    const tripContext = {
      destination: 'Paris',
      origin: 'JFK',
      departure_date: '2026-06-01',
      return_date: '2026-06-10',
      budget_total: 5000,
      budget_currency: 'USD',
      travelers: 2,
      transport_mode: 'flying' as const,
      preferences: {},
      selected_flights: [],
      selected_hotels: [],
      selected_car_rentals: [],
      selected_experiences: [],
      total_spent: 0,
    };
    const result = buildSystemPrompt(
      tripContext,
      { phase: 'PLANNING' },
      {},
      DEFAULT_COMPLETION_TRACKER,
    );
    expect(result).toContain('Trip Planning Checklist');
    expect(result).toContain('Not yet discussed');
  });

  it('should include current date', () => {
    const result = buildSystemPrompt();
    const today = new Date().toISOString().split('T')[0];
    expect(result).toContain(today);
  });

  it('should include tool descriptions for agent autonomy', () => {
    const result = buildSystemPrompt();
    expect(result).toContain('search_flights');
    expect(result).toContain('format_response');
    expect(result).toContain('skip_category');
  });
});
```

- [ ] **Step 4: Run tests**

Run: `cd server && npx vitest run src/prompts/`
Expected: PASS

- [ ] **Step 5: Verify and commit**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

```bash
git add server/src/prompts/system-prompt.ts server/src/prompts/system-prompt.test.ts server/src/prompts/trip-context.ts
git commit -m "feat: replace 12 micro-prompts with single agentic system prompt"
```

---

## Task 3: Update format_response skip_category Type

**Files:**

- Modify: `server/src/tools/definitions.ts`

- [ ] **Step 1: Update skip_category in format_response definition**

In `server/src/tools/definitions.ts`, find the `skip_category` property inside the `format_response` tool definition (around line 372). Change from:

```typescript
        skip_category: {
          type: 'boolean',
          description:
            'Set to true when the user declines the current category (e.g., "No, I don\'t need a hotel"). The system will skip this category and move to the next.',
        },
```

To:

```typescript
        skip_category: {
          type: 'string',
          enum: ['flights', 'hotels', 'car_rental', 'experiences'],
          description:
            'Set to the category name when the user declines it (e.g., "car_rental" when the user says "No, I don\'t need a car"). The system will mark this category as skipped.',
        },
```

- [ ] **Step 2: Verify and commit**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

```bash
git add server/src/tools/definitions.ts
git commit -m "feat: change skip_category from boolean to category name string"
```

---

## Task 4: Simplify Chat Handler + Remove Old Imports

**Files:**

- Modify: `server/src/handlers/chat/chat.ts`
- Modify: `server/src/services/agent.service.ts`

- [ ] **Step 1: Update chat handler imports and flow**

In `server/src/handlers/chat/chat.ts`, update imports to use new names:

```typescript
import {
  DEFAULT_COMPLETION_TRACKER,
  computeNudge,
  getFlowPosition,
  hasAnySelection,
  normalizeCompletionTracker,
  updateCompletionTracker,
} from 'app/prompts/booking-steps.js';
```

Remove the import of `advanceBookingState` and `DEFAULT_BOOKING_STATE` and `normalizeBookingState`.

- [ ] **Step 2: Simplify the booking state / flow position section**

Replace the booking state initialization and idle→asking promotion (lines 182-211) with:

```typescript
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
```

Note: No more `currentBookingState` clone, no idle→asking promotion. `getFlowPosition` no longer takes a BookingState parameter.

- [ ] **Step 3: Update runAgentLoop call to pass tracker and nudge**

Update the `runAgentLoop` call:

```typescript
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
```

- [ ] **Step 4: Replace advanceBookingState with updateCompletionTracker**

Replace the entire "Advance booking state after the agent loop" section (lines 314-363) with:

```typescript
// Update completion tracker after the agent loop
if (updatedTrip) {
  const newTracker = updateCompletionTracker(tracker, result, {
    ...updatedTrip,
    transport_mode: updatedTrip.transport_mode ?? null,
    flights: (updatedTrip.flights ?? []).map((f) => ({ id: f.id })),
    hotels: (updatedTrip.hotels ?? []).map((h) => ({ id: h.id })),
    car_rentals: (updatedTrip.car_rentals ?? []).map((c) => ({ id: c.id })),
    experiences: (updatedTrip.experiences ?? []).map((e) => ({ id: e.id })),
    status: updatedTrip.status ?? 'planning',
  });

  // Empty itinerary guard
  if (!hasAnySelection(newTracker) && result.formatResponse?.skip_category) {
    // If user just skipped something and has nothing selected, gently prompt
    const allSkippedOrPending = [
      'flights',
      'hotels',
      'car_rental',
      'experiences',
    ].every((cat) => {
      const status = newTracker[cat as keyof typeof newTracker];
      return status === 'skipped' || status === 'pending';
    });
    if (allSkippedOrPending && !hasAnySelection(newTracker)) {
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
```

- [ ] **Step 5: Update agent.service.ts to accept tracker and pass to prompt builder**

In `server/src/services/agent.service.ts`, update `runAgentLoop` signature:

```typescript
export async function runAgentLoop(
  messages: Anthropic.MessageParam[],
  tripContext: TripContext | undefined,
  onEvent: (event: SSEEvent) => void,
  conversationId?: string | null,
  toolContext?: ToolContext,
  enrichmentNodes?: ChatNode[],
  flowPosition?: FlowPosition,
  promptOptions?: { hasCriticalAdvisory?: boolean; nudge?: string | null },
  tracker?: CompletionTracker,
): Promise<AgentResult> {
```

Add import:

```typescript
import {
  type CompletionTracker,
  type FlowPosition,
} from 'app/prompts/booking-steps.js';
```

Update the systemPromptBuilder:

```typescript
    systemPromptBuilder: (ctx: unknown, pos: unknown) =>
      buildSystemPrompt(
        ctx as TripContext | undefined,
        pos as FlowPosition | undefined,
        promptOptions,
        tracker,
      ),
```

Update the `buildSystemPrompt` import to include `PromptOptions`:

```typescript
import { buildSystemPrompt } from 'app/prompts/system-prompt.js';
```

- [ ] **Step 6: Remove backward-compat exports from booking-steps.ts**

Remove the temporary backward-compat exports added in Task 1 Step 5 (the `CategoryStatus`, `BookingState`, `DEFAULT_BOOKING_STATE`, `normalizeBookingState`, `CATEGORY_ORDER`, `advanceBookingState` re-exports).

- [ ] **Step 7: Delete category-prompts.ts content**

Replace `server/src/prompts/category-prompts.ts` with an empty file (or a comment):

```typescript
// Category prompts removed in agentic redesign.
// The single system prompt in system-prompt.ts replaces all per-category prompts.
```

Replace `server/src/prompts/category-prompts.test.ts` with:

```typescript
import { describe, it } from 'vitest';

describe('category-prompts (deprecated)', () => {
  it('has been replaced by single system prompt', () => {
    // Per-category prompts removed in agentic redesign.
    // See system-prompt.test.ts for the single prompt tests.
  });
});
```

- [ ] **Step 8: Update chat handler tests**

Read `server/src/handlers/chat/chat.test.ts` and update any imports and references from `DEFAULT_BOOKING_STATE` → `DEFAULT_COMPLETION_TRACKER`, `normalizeBookingState` → `normalizeCompletionTracker`, etc. Update mock return values to use the new tracker shape.

- [ ] **Step 9: Verify and commit**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

```bash
git add server/src/handlers/chat/chat.ts server/src/services/agent.service.ts server/src/prompts/booking-steps.ts server/src/prompts/category-prompts.ts server/src/prompts/category-prompts.test.ts server/src/handlers/chat/chat.test.ts
git commit -m "feat: simplify chat handler to use CompletionTracker, remove state machine orchestration"
```

---

## Task 5: Destination Expansion — Add 3 Missing Images

**Files:**

- Modify: `web-client/src/lib/destinationImage.ts`

- [ ] **Step 1: Source and verify Unsplash photo IDs**

Search Unsplash for real photo IDs for Cusco, Maldives, and Naples. Verify each returns HTTP 200 from `https://images.unsplash.com/photo-{ID}?w=100`.

- [ ] **Step 2: Add entries to CITY_IMAGES**

In `web-client/src/lib/destinationImage.ts`, add to the `CITY_IMAGES` map:

```typescript
  cusco: 'VERIFIED_CUSCO_ID',
  maldives: 'VERIFIED_MALDIVES_ID',
  naples: 'VERIFIED_NAPLES_ID',
```

Also remove the 4 entries that don't have destination pages (unless we're adding them in Task 6): `auckland`, `lima`, `'mexico city'`, `mumbai` — actually keep them since Task 6 will add their destination pages.

- [ ] **Step 3: Verify and commit**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

```bash
git add web-client/src/lib/destinationImage.ts
git commit -m "feat: add Unsplash images for Cusco, Maldives, and Naples"
```

---

## Task 6: Destination Expansion — Add 4 New Destination Pages

**Files:**

- Modify: `web-client/src/data/destinations.ts`

- [ ] **Step 1: Generate destination content for Auckland, Lima, Mexico City, Mumbai**

Add 4 new entries to the `DESTINATIONS` array in `web-client/src/data/destinations.ts`. Each entry needs all 15 fields matching the existing `Destination` interface:

- `slug` (URL-friendly)
- `name`, `country`
- `categories` (array from: beach, city, adventure, romantic, food-wine, culture, budget, family)
- `price_level` (1-4)
- `best_season`
- `description` (2-3 paragraphs)
- `currency`, `language`
- `estimated_daily_budget` ({ budget, mid, luxury })
- `visa_summary`
- `top_experiences` (10 items with name, category, description, estimated_cost)
- `dining_highlights` (4-6 items with name, cuisine, price_level, description)
- `neighborhoods` (3-4 items with name, description)
- `weather` (12 months with month, high_c, low_c, rainfall_mm)

Generate accurate, engaging content — not placeholder data.

- [ ] **Step 2: Verify and commit**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

```bash
git add web-client/src/data/destinations.ts
git commit -m "feat: add Auckland, Lima, Mexico City, and Mumbai destination pages"
```

---

## Self-Review

**1. Spec coverage:**

| Spec Section                                                  | Task(s)                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1. CompletionTracker type + normalizer                        | Task 1                                                                    |
| 1. Simplified FlowPosition (3 phases)                         | Task 1                                                                    |
| 2. Single system prompt (role, tools, guidelines, guardrails) | Task 2                                                                    |
| 2. Trip checklist (dynamic)                                   | Task 2 (formatChecklist)                                                  |
| 2. User preferences (dynamic)                                 | Task 2 (existing formatTripContext)                                       |
| 2. Server nudge (conditional)                                 | Task 1 (computeNudge) + Task 2 (prompt injection) + Task 4 (chat handler) |
| 3. Nudge mechanism (turns_since_last_progress)                | Task 1 (tracker) + Task 4 (chat handler)                                  |
| 4. Tracker updates (search/select/skip/ground truth)          | Task 1 (updateCompletionTracker)                                          |
| 4. skip_category: boolean → string                            | Task 3                                                                    |
| 5. Removed exports                                            | Task 4                                                                    |
| 5. v1→v2 migration                                            | Task 1 (normalizeCompletionTracker)                                       |
| 5. Empty itinerary / confirm gate                             | Task 4 (kept)                                                             |
| 6. Add 4 destinations                                         | Task 6                                                                    |
| 6. Add 3 images                                               | Task 5                                                                    |

**2. Placeholder scan:** No TBDs found. Task 5 has `VERIFIED_*_ID` placeholders but these are explicitly marked as needing sourcing during implementation, not left as literal strings.

**3. Type consistency:**

- `CompletionTracker` defined in Task 1, used in Tasks 2, 4
- `TrackerStatus` defined in Task 1, values consistent (`pending/searching/selected/skipped`)
- `FlowPosition` simplified in Task 1 (3 phases), used in Tasks 2, 4
- `updateCompletionTracker` defined in Task 1, called in Task 4
- `computeNudge` defined in Task 1, called in Task 4
- `hasAnySelection` defined in Task 1, called in Task 4
- `formatChecklist` defined in Task 2, called in Task 2 (buildSystemPrompt)
- `PromptOptions` type in Task 2 includes `nudge?: string | null` matching Task 4's usage
- `buildSystemPrompt` in Task 2 accepts `tracker?: CompletionTracker` matching Task 4's call

All consistent.
