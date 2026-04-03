# Per-Category State Machines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat `getBookingStep()` with per-category state machines (flights, hotels, car_rental, experiences) that track sub-states (`idle | asking | presented | done | skipped`) in a JSONB column on the conversations table, giving Claude precise single-task prompts at every point in the booking flow.

**Architecture:** A `booking_state` JSONB column on `conversations` stores each category's status. `getFlowPosition()` reads trip + booking_state to return the active phase/category/status. `advanceBookingState()` transitions categories after the agent loop based on tool calls and trip changes. Each category has prompts keyed by status. COLLECT_DETAILS and CONFIRM phases are unchanged.

**Tech Stack:** TypeScript, PostgreSQL (JSONB), Express 5, Anthropic SDK

**Design Spec:** `docs/superpowers/specs/2026-04-03-per-category-state-machines-design.md`

**Verification before every commit:** `pnpm test && pnpm build`

---

## File Structure

### New Files

```
server/migrations/1771879388556_add-booking-state.js    # booking_state JSONB on conversations
server/src/prompts/category-prompts.ts                  # Per-category prompt maps
server/src/prompts/category-prompts.test.ts             # Tests for category prompts
```

### Modified Files

```
server/src/prompts/booking-steps.ts                     # Rewrite: FlowPosition, getFlowPosition(), advanceBookingState()
server/src/prompts/booking-steps.test.ts                # Rewrite: tests for new types and functions
server/src/prompts/system-prompt.ts                     # Accept FlowPosition instead of BookingStep
server/src/prompts/system-prompt.test.ts                # Update tests
server/src/repositories/conversations/conversations.ts  # Add booking_state to Conversation, add updateBookingState()
server/src/handlers/chat/chat.ts                        # Read/write booking_state, call advanceBookingState
server/src/handlers/chat/chat.test.ts                   # Update tests
server/src/services/agent.service.ts                    # Pass FlowPosition instead of BookingStep
server/src/services/AgentOrchestrator.ts                # Add skip_category to FormatResponseData
server/src/tools/definitions.ts                         # Add skip_category to format_response
```

---

## Task 1: Database Migration — booking_state Column

**Files:**

- Create: `server/migrations/1771879388556_add-booking-state.js`
- Modify: `server/src/repositories/conversations/conversations.ts`

- [ ] **Step 1: Create migration**

Create `server/migrations/1771879388556_add-booking-state.js`:

```javascript
export const up = (pgm) => {
  pgm.addColumns('conversations', {
    booking_state: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func(
        `'{"flights":{"status":"idle"},"hotels":{"status":"idle"},"car_rental":{"status":"idle"},"experiences":{"status":"idle"}}'::jsonb`,
      ),
    },
  });
};

export const down = (pgm) => {
  pgm.dropColumns('conversations', ['booking_state']);
};
```

- [ ] **Step 2: Add booking_state to Conversation interface and add updateBookingState**

In `server/src/repositories/conversations/conversations.ts`:

Add `booking_state` to the `Conversation` interface:

```typescript
export interface Conversation {
  id: string;
  trip_id: string;
  booking_state: BookingState;
  created_at: string;
  updated_at: string;
}
```

Add import at top (will exist after Task 2):

```typescript
import type { BookingState } from 'app/prompts/booking-steps.js';
```

Add `updateBookingState` function:

```typescript
export async function updateBookingState(
  conversationId: string,
  bookingState: BookingState,
): Promise<void> {
  await query(
    `UPDATE conversations SET booking_state = $1, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(bookingState), conversationId],
  );
}
```

Note: The `BookingState` type won't exist until Task 2. This file will have a type error until then. That's OK — we'll verify after Task 2.

- [ ] **Step 3: Commit**

```bash
git add server/migrations/1771879388556_add-booking-state.js server/src/repositories/conversations/conversations.ts
git commit -m "feat: add booking_state JSONB column to conversations table"
```

---

## Task 2: Core Types and Functions — getFlowPosition + advanceBookingState

**Files:**

- Rewrite: `server/src/prompts/booking-steps.ts`
- Rewrite: `server/src/prompts/booking-steps.test.ts`

- [ ] **Step 1: Write tests for getFlowPosition**

Replace the entire contents of `server/src/prompts/booking-steps.test.ts`:

```typescript
import type { AgentResult } from 'app/services/agent.service.js';
import { describe, expect, it } from 'vitest';

import {
  type BookingState,
  DEFAULT_BOOKING_STATE,
  type FlowPosition,
  advanceBookingState,
  getFlowPosition,
} from './booking-steps.js';

// Helper to build a trip state
function trip(overrides: Record<string, unknown> = {}) {
  return {
    destination: 'Tokyo',
    origin: 'JFK',
    departure_date: '2026-07-01',
    return_date: '2026-07-10',
    budget_total: 5000,
    transport_mode: null as 'flying' | 'driving' | null,
    flights: [] as Array<{ id: string }>,
    hotels: [] as Array<{ id: string }>,
    car_rentals: [] as Array<{ id: string }>,
    experiences: [] as Array<{ id: string }>,
    status: 'planning',
    ...overrides,
  };
}

function bs(overrides: Partial<BookingState> = {}): BookingState {
  return { ...DEFAULT_BOOKING_STATE, ...overrides };
}

describe('getFlowPosition', () => {
  it('returns COLLECT_DETAILS when budget is missing', () => {
    const pos = getFlowPosition(trip({ budget_total: null }), bs());
    expect(pos).toEqual({ phase: 'COLLECT_DETAILS' });
  });

  it('returns COLLECT_DETAILS when origin is missing', () => {
    const pos = getFlowPosition(trip({ origin: null }), bs());
    expect(pos).toEqual({ phase: 'COLLECT_DETAILS' });
  });

  it('returns flights/idle when transport_mode is null', () => {
    const pos = getFlowPosition(trip(), bs());
    expect(pos).toEqual({
      phase: 'CATEGORY',
      category: 'flights',
      status: 'idle',
    });
  });

  it('returns flights with its current status from booking_state', () => {
    const pos = getFlowPosition(
      trip({ transport_mode: 'flying' }),
      bs({ flights: { status: 'asking' } }),
    );
    expect(pos).toEqual({
      phase: 'CATEGORY',
      category: 'flights',
      status: 'asking',
    });
  });

  it('returns flights/presented when browsing', () => {
    const pos = getFlowPosition(
      trip({ transport_mode: 'flying' }),
      bs({ flights: { status: 'presented' } }),
    );
    expect(pos).toEqual({
      phase: 'CATEGORY',
      category: 'flights',
      status: 'presented',
    });
  });

  it('skips flights when driving, goes to hotels', () => {
    const pos = getFlowPosition(trip({ transport_mode: 'driving' }), bs());
    expect(pos).toEqual({
      phase: 'CATEGORY',
      category: 'hotels',
      status: 'idle',
    });
  });

  it('returns hotels when flights are done', () => {
    const pos = getFlowPosition(
      trip({ transport_mode: 'flying', flights: [{ id: '1' }] }),
      bs({ flights: { status: 'done' } }),
    );
    expect(pos).toEqual({
      phase: 'CATEGORY',
      category: 'hotels',
      status: 'idle',
    });
  });

  it('returns car_rental when hotels are done', () => {
    const pos = getFlowPosition(
      trip({ transport_mode: 'flying', flights: [{ id: '1' }] }),
      bs({ flights: { status: 'done' }, hotels: { status: 'done' } }),
    );
    expect(pos).toEqual({
      phase: 'CATEGORY',
      category: 'car_rental',
      status: 'idle',
    });
  });

  it('skips a category that is skipped', () => {
    const pos = getFlowPosition(
      trip({ transport_mode: 'flying', flights: [{ id: '1' }] }),
      bs({ flights: { status: 'done' }, hotels: { status: 'skipped' } }),
    );
    expect(pos).toEqual({
      phase: 'CATEGORY',
      category: 'car_rental',
      status: 'idle',
    });
  });

  it('returns CONFIRM when all categories done/skipped', () => {
    const pos = getFlowPosition(
      trip({ transport_mode: 'flying', flights: [{ id: '1' }] }),
      bs({
        flights: { status: 'done' },
        hotels: { status: 'done' },
        car_rental: { status: 'skipped' },
        experiences: { status: 'done' },
      }),
    );
    expect(pos).toEqual({ phase: 'CONFIRM' });
  });

  it('returns COMPLETE when status is not planning', () => {
    const pos = getFlowPosition(trip({ status: 'saved' }), bs());
    expect(pos).toEqual({ phase: 'COMPLETE' });
  });
});

describe('advanceBookingState', () => {
  const mockResult = (
    toolNames: string[] = [],
    skipCategory = false,
  ): AgentResult => ({
    response: 'ok',
    tool_calls: toolNames.map((name, i) => ({
      tool_name: name,
      tool_id: `t${i}`,
      input: {},
      result: {},
    })),
    total_tokens: { input: 0, output: 0 },
    nodes: [],
    formatResponse: skipCategory ? { text: 'ok', skip_category: true } : null,
  });

  it('advances asking → presented when search tool is called', () => {
    const result = advanceBookingState(
      bs({ flights: { status: 'asking' } }),
      'flights',
      'asking',
      mockResult(['search_flights']),
      trip({ transport_mode: 'flying' }),
    );
    expect(result.flights.status).toBe('presented');
  });

  it('advances asking → skipped when skip_category is true', () => {
    const result = advanceBookingState(
      bs({ hotels: { status: 'asking' } }),
      'hotels',
      'asking',
      mockResult([], true),
      trip({ transport_mode: 'flying' }),
    );
    expect(result.hotels.status).toBe('skipped');
  });

  it('advances presented → done when trip gains a selection', () => {
    const result = advanceBookingState(
      bs({ flights: { status: 'presented' } }),
      'flights',
      'presented',
      mockResult(),
      trip({ transport_mode: 'flying', flights: [{ id: '1' }] }),
    );
    expect(result.flights.status).toBe('done');
  });

  it('stays presented when no selection made', () => {
    const result = advanceBookingState(
      bs({ flights: { status: 'presented' } }),
      'flights',
      'presented',
      mockResult(),
      trip({ transport_mode: 'flying' }),
    );
    expect(result.flights.status).toBe('presented');
  });

  it('re-search: presented → presented when search tool called again', () => {
    const result = advanceBookingState(
      bs({ flights: { status: 'presented' } }),
      'flights',
      'presented',
      mockResult(['search_flights']),
      trip({ transport_mode: 'flying' }),
    );
    expect(result.flights.status).toBe('presented');
  });

  it('does not mutate other categories', () => {
    const result = advanceBookingState(
      bs({ flights: { status: 'asking' }, hotels: { status: 'idle' } }),
      'flights',
      'asking',
      mockResult(['search_flights']),
      trip({ transport_mode: 'flying' }),
    );
    expect(result.hotels.status).toBe('idle');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/prompts/booking-steps.test.ts`
Expected: FAIL — imports don't match

- [ ] **Step 3: Rewrite booking-steps.ts**

Replace the entire contents of `server/src/prompts/booking-steps.ts`:

```typescript
import type { AgentResult } from 'app/services/agent.service.js';

// --- State types ---

export type CategoryName = 'flights' | 'hotels' | 'car_rental' | 'experiences';

export type CategoryStatus =
  | 'idle'
  | 'asking'
  | 'presented'
  | 'done'
  | 'skipped';

export interface CategoryState {
  status: CategoryStatus;
  meta?: Record<string, unknown>;
}

export interface BookingState {
  flights: CategoryState;
  hotels: CategoryState;
  car_rental: CategoryState;
  experiences: CategoryState;
}

export const DEFAULT_BOOKING_STATE: BookingState = {
  flights: { status: 'idle' },
  hotels: { status: 'idle' },
  car_rental: { status: 'idle' },
  experiences: { status: 'idle' },
};

// --- Flow position ---

export type FlowPosition =
  | { phase: 'COLLECT_DETAILS' }
  | { phase: 'CATEGORY'; category: CategoryName; status: CategoryStatus }
  | { phase: 'CONFIRM' }
  | { phase: 'COMPLETE' };

export interface TripState {
  destination: string;
  origin: string | null;
  departure_date: string | null;
  return_date: string | null;
  budget_total: number | null;
  transport_mode: 'flying' | 'driving' | null;
  flights: Array<{ id: string }>;
  hotels: Array<{ id: string }>;
  car_rentals?: Array<{ id: string }>;
  experiences: Array<{ id: string }>;
  status: string;
}

const CATEGORY_ORDER: CategoryName[] = [
  'flights',
  'hotels',
  'car_rental',
  'experiences',
];

const SEARCH_TOOLS: Record<CategoryName, string> = {
  flights: 'search_flights',
  hotels: 'search_hotels',
  car_rental: 'search_car_rentals',
  experiences: 'search_experiences',
};

const SELECTION_KEYS: Record<
  CategoryName,
  'flights' | 'hotels' | 'car_rentals' | 'experiences'
> = {
  flights: 'flights',
  hotels: 'hotels',
  car_rental: 'car_rentals',
  experiences: 'experiences',
};

export function getFlowPosition(
  trip: TripState,
  bookingState: BookingState,
): FlowPosition {
  if (trip.status !== 'planning') {
    return { phase: 'COMPLETE' };
  }

  if (
    trip.budget_total === null ||
    trip.departure_date === null ||
    trip.return_date === null ||
    trip.origin === null
  ) {
    return { phase: 'COLLECT_DETAILS' };
  }

  // If transport_mode not set, flights category handles the flying/driving question
  if (trip.transport_mode === null) {
    return {
      phase: 'CATEGORY',
      category: 'flights',
      status: bookingState.flights.status,
    };
  }

  for (const cat of CATEGORY_ORDER) {
    // Auto-skip flights when driving
    if (cat === 'flights' && trip.transport_mode === 'driving') {
      continue;
    }

    const catState = bookingState[cat];
    if (catState.status !== 'done' && catState.status !== 'skipped') {
      return { phase: 'CATEGORY', category: cat, status: catState.status };
    }
  }

  return { phase: 'CONFIRM' };
}

// --- State transitions ---

export function advanceBookingState(
  bookingState: BookingState,
  category: CategoryName | string,
  currentStatus: CategoryStatus,
  agentResult: AgentResult,
  updatedTrip: TripState,
): BookingState {
  const cat = category as CategoryName;
  const newState = structuredClone(bookingState);

  // Check if skip_category was set
  const skipCategory =
    (agentResult as { formatResponse?: { skip_category?: boolean } })
      .formatResponse?.skip_category === true;

  if (skipCategory) {
    newState[cat] = { ...newState[cat], status: 'skipped' };
    return newState;
  }

  const searchTool = SEARCH_TOOLS[cat];
  const searchCalled = agentResult.tool_calls.some(
    (tc) => tc.tool_name === searchTool,
  );
  const selectionKey = SELECTION_KEYS[cat];
  const tripSelections =
    selectionKey === 'car_rentals'
      ? (updatedTrip.car_rentals ?? [])
      : updatedTrip[selectionKey];
  const hasSelection = tripSelections.length > 0;

  switch (currentStatus) {
    case 'idle':
      newState[cat] = { ...newState[cat], status: 'asking' };
      break;

    case 'asking':
      if (searchCalled) {
        newState[cat] = { ...newState[cat], status: 'presented' };
      }
      break;

    case 'presented':
      if (hasSelection) {
        newState[cat] = { ...newState[cat], status: 'done' };
      }
      // If search called again (re-search), stay in presented
      break;

    default:
      break;
  }

  return newState;
}
```

- [ ] **Step 4: Run tests**

Run: `cd server && npx vitest run src/prompts/booking-steps.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Verify full suite**

Run: `pnpm test && pnpm build`
Expected: Some tests may fail in system-prompt.test.ts (imports changed). That's expected — fixed in Task 3.

- [ ] **Step 6: Commit**

```bash
git add server/src/prompts/booking-steps.ts server/src/prompts/booking-steps.test.ts
git commit -m "feat: rewrite booking-steps with FlowPosition, getFlowPosition, advanceBookingState"
```

---

## Task 3: Per-Category Prompts

**Files:**

- Create: `server/src/prompts/category-prompts.ts`
- Create: `server/src/prompts/category-prompts.test.ts`

- [ ] **Step 1: Write tests**

Create `server/src/prompts/category-prompts.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import type { CategoryName, CategoryStatus } from './booking-steps.js';
import { getCategoryPrompt, getPhasePrompt } from './category-prompts.js';

describe('category-prompts', () => {
  const categories: CategoryName[] = [
    'flights',
    'hotels',
    'car_rental',
    'experiences',
  ];
  const statuses: CategoryStatus[] = ['idle', 'asking', 'presented'];

  for (const cat of categories) {
    for (const status of statuses) {
      it(`returns a prompt for ${cat}/${status}`, () => {
        const prompt = getCategoryPrompt(cat, status);
        expect(prompt.length).toBeGreaterThan(20);
        expect(prompt).toContain('format_response');
      });
    }
  }

  it('flights/idle mentions flying and driving', () => {
    const prompt = getCategoryPrompt('flights', 'idle');
    expect(prompt).toContain('flying');
    expect(prompt).toContain('driving');
  });

  it('flights/asking mentions time preference', () => {
    const prompt = getCategoryPrompt('flights', 'asking');
    expect(prompt).toMatch(/time|morning|afternoon|evening/i);
  });

  it('hotels/asking mentions hotel', () => {
    const prompt = getCategoryPrompt('hotels', 'asking');
    expect(prompt).toMatch(/hotel/i);
  });

  it('car_rental/asking mentions rental car', () => {
    const prompt = getCategoryPrompt('car_rental', 'asking');
    expect(prompt).toMatch(/rental car/i);
  });

  it('experiences/asking mentions preferences', () => {
    const prompt = getCategoryPrompt('experiences', 'asking');
    expect(prompt).toMatch(/preferences/i);
  });

  it('all presented prompts say not to describe results', () => {
    for (const cat of categories) {
      const prompt = getCategoryPrompt(cat, 'presented');
      expect(prompt).toMatch(/do not|don't|never/i);
    }
  });

  it('COLLECT_DETAILS phase prompt mentions form', () => {
    expect(getPhasePrompt('COLLECT_DETAILS')).toMatch(/form/i);
  });

  it('CONFIRM phase prompt mentions confirm or book', () => {
    expect(getPhasePrompt('CONFIRM')).toMatch(/confirm|book/i);
  });

  it('all prompts include brevity rule', () => {
    for (const cat of categories) {
      for (const status of statuses) {
        expect(getCategoryPrompt(cat, status)).toMatch(/1-2 sentences/i);
      }
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/prompts/category-prompts.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement category-prompts.ts**

Create `server/src/prompts/category-prompts.ts`:

```typescript
import type { CategoryName, CategoryStatus } from './booking-steps.js';

const SHARED_RULES = `
## Rules
- 1-2 sentences max. No numbered lists. No bullet points for questions.
- NEVER describe search results in text — the cards handle it.
- Travel questions: answer in 1-2 sentences, then redirect to the current step.
- Call update_trip when the user provides trip details.
- Always call format_response as your LAST tool call.
- Set skip_category: true in format_response if the user declines this category.
- Max 15 tool calls per turn.`;

const CATEGORY_PROMPTS: Record<CategoryName, Record<string, string>> = {
  flights: {
    idle: `You are a travel assistant. Ask the user one question: "Will you be flying or driving?"
If flying, call update_trip with transport_mode: "flying". If driving, call update_trip with transport_mode: "driving" and set skip_category: true.
Provide quick_replies: ["I'll be flying", "I'll drive"].`,

    asking: `The user is flying. Ask what time of day they prefer (morning, afternoon, or evening). Then search flights. The flight cards will show — do not describe them.`,

    presented: `The user is browsing flight options. Do NOT re-describe the results — the cards are visible. If they ask about a flight, answer briefly. If they want different options, search again. Wait for their selection.`,
  },

  hotels: {
    idle: `Ask: "Do you need a hotel?" If yes, search hotels. If no, acknowledge and set skip_category: true in format_response.
Provide quick_replies: ["Yes, find me a hotel", "No, I have lodging"].`,

    asking: `Ask: "Do you need a hotel?" If yes, search hotels. If no, acknowledge and set skip_category: true in format_response.
Provide quick_replies: ["Yes, find me a hotel", "No, I have lodging"].`,

    presented: `The user is browsing hotel options. Do not describe the results — the cards are visible. Answer questions briefly. Wait for their selection.`,
  },

  car_rental: {
    idle: `Ask: "Will you need a rental car?" If yes, search car rentals. If no, acknowledge and set skip_category: true in format_response.
Provide quick_replies: ["Yes, find me a car", "No, I don't need one"].`,

    asking: `Ask: "Will you need a rental car?" If yes, search car rentals. If no, acknowledge and set skip_category: true in format_response.
Provide quick_replies: ["Yes, find me a car", "No, I don't need one"].`,

    presented: `The user is browsing car rental options. Don't describe the results — the cards are visible. Answer questions briefly. Wait for their selection.`,
  },

  experiences: {
    idle: `Based on the user's preferences, suggest relevant experience categories in one sentence. Then search experiences. The cards will show the results.
Provide quick_replies: ["Find dining options", "Show me adventures", "I'm all set"].`,

    asking: `Based on the user's preferences, suggest relevant experience categories in one sentence. Then search experiences. The cards will show the results.
Provide quick_replies: ["Find dining options", "Show me adventures", "I'm all set"].`,

    presented: `The user is browsing experiences. Do not describe the results — the cards are visible. Answer questions briefly. Wait for their selection. If they say they're done, set skip_category: true.`,
  },
};

const PHASE_PROMPTS: Record<string, string> = {
  COLLECT_DETAILS: `A form is being shown to collect trip details. Acknowledge the destination in one friendly sentence. Do NOT ask questions — the form handles data collection.`,

  CONFIRM: `Summarize the trip briefly: destination, dates, selected flight, hotel, car rental, experiences, total cost. Ask "Ready to book?" Provide quick_replies: ["Confirm booking", "Make changes"].`,

  COMPLETE: `The trip is booked. Answer follow-up questions about the trip.`,
};

export function getCategoryPrompt(
  category: CategoryName,
  status: CategoryStatus,
): string {
  const prompts = CATEGORY_PROMPTS[category];
  const key =
    status === 'idle' ? 'idle' : status === 'asking' ? 'asking' : 'presented';
  const prompt = prompts[key] ?? prompts['asking'];
  return `You are a travel planning assistant.\n\n## Your Task\n${prompt}\n${SHARED_RULES}`;
}

export function getPhasePrompt(
  phase: 'COLLECT_DETAILS' | 'CONFIRM' | 'COMPLETE',
): string {
  return `You are a travel planning assistant.\n\n## Your Task\n${PHASE_PROMPTS[phase]}\n${SHARED_RULES}`;
}
```

- [ ] **Step 4: Run tests**

Run: `cd server && npx vitest run src/prompts/category-prompts.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/prompts/category-prompts.ts server/src/prompts/category-prompts.test.ts
git commit -m "feat: add per-category prompts keyed by status"
```

---

## Task 4: Update System Prompt + Agent Service

**Files:**

- Modify: `server/src/prompts/system-prompt.ts`
- Modify: `server/src/prompts/system-prompt.test.ts`
- Modify: `server/src/services/agent.service.ts`

- [ ] **Step 1: Rewrite system-prompt.ts**

Replace entire contents:

```typescript
import type { FlowPosition } from './booking-steps.js';
import { getCategoryPrompt, getPhasePrompt } from './category-prompts.js';
import { type TripContext, formatTripContext } from './trip-context.js';

export function buildSystemPrompt(
  tripContext?: TripContext,
  flowPosition?: FlowPosition,
): string {
  let stepPrompt: string;

  if (!flowPosition || flowPosition.phase === 'COLLECT_DETAILS') {
    stepPrompt = getPhasePrompt('COLLECT_DETAILS');
  } else if (flowPosition.phase === 'CATEGORY') {
    stepPrompt = getCategoryPrompt(flowPosition.category, flowPosition.status);
  } else if (flowPosition.phase === 'CONFIRM') {
    stepPrompt = getPhasePrompt('CONFIRM');
  } else {
    stepPrompt = getPhasePrompt('COMPLETE');
  }

  const parts = [stepPrompt];
  parts.push(
    `\n\n## Current Date\n\nToday is ${new Date().toISOString().split('T')[0]}.`,
  );

  if (tripContext) {
    parts.push(
      `\n\n## Current Trip State\n\n${formatTripContext(tripContext)}`,
    );
  }

  return parts.join('');
}
```

- [ ] **Step 2: Update system-prompt.test.ts**

Replace entire contents:

```typescript
import type { FlowPosition } from 'app/prompts/booking-steps.js';
import { buildSystemPrompt } from 'app/prompts/system-prompt.js';
import type { TripContext } from 'app/prompts/trip-context.js';
import { describe, expect, it } from 'vitest';

const fullCtx: TripContext = {
  destination: 'Barcelona',
  origin: 'SFO',
  departure_date: '2026-07-01',
  return_date: '2026-07-06',
  budget_total: 3000,
  budget_currency: 'USD',
  travelers: 2,
  transport_mode: 'flying',
  preferences: {},
  selected_flights: [
    {
      airline: 'United',
      flight_number: 'UA123',
      price: 450,
      departure_time: '2026-07-01T08:00:00Z',
      arrival_time: '2026-07-01T20:00:00Z',
    },
  ],
  selected_car_rentals: [],
  selected_hotels: [],
  selected_experiences: [],
  total_spent: 450,
};

describe('buildSystemPrompt', () => {
  it('defaults to COLLECT_DETAILS when no position', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toMatch(/form/i);
  });

  it('uses category prompt for CATEGORY phase', () => {
    const pos: FlowPosition = {
      phase: 'CATEGORY',
      category: 'flights',
      status: 'idle',
    };
    const prompt = buildSystemPrompt(undefined, pos);
    expect(prompt).toContain('flying');
    expect(prompt).toContain('driving');
  });

  it('uses CONFIRM prompt', () => {
    const pos: FlowPosition = { phase: 'CONFIRM' };
    const prompt = buildSystemPrompt(undefined, pos);
    expect(prompt).toMatch(/confirm|book/i);
  });

  it('includes today date', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(buildSystemPrompt()).toContain(today!);
  });

  it('includes trip context', () => {
    const prompt = buildSystemPrompt(fullCtx, {
      phase: 'CATEGORY',
      category: 'hotels',
      status: 'asking',
    });
    expect(prompt).toContain('Barcelona');
    expect(prompt).toContain('UA123');
  });

  it('includes format_response', () => {
    expect(buildSystemPrompt()).toContain('format_response');
  });

  it('includes brevity rule', () => {
    expect(buildSystemPrompt()).toMatch(/1-2 sentences/i);
  });
});
```

- [ ] **Step 3: Update agent.service.ts**

Change import from `BookingStep` to `FlowPosition`:

```typescript
import { type FlowPosition } from 'app/prompts/booking-steps.js';
```

Change `bookingStep?: BookingStep` to `flowPosition?: FlowPosition` in `runAgentLoop` signature.

Update `systemPromptBuilder`:

```typescript
systemPromptBuilder: (ctx: unknown, pos: unknown) =>
  buildSystemPrompt(ctx as TripContext | undefined, pos as FlowPosition | undefined),
```

Update `orchestrator.run()` call:

```typescript
const result = await orchestrator.run(
  messages,
  [tripContext, flowPosition],
  onEvent,
  meta,
);
```

- [ ] **Step 4: Verify**

Run: `pnpm test && pnpm build`
Expected: All pass (chat handler tests may need the flowPosition parameter — they already pass `bookingStep` which needs renaming, but since the parameter is optional it should still work).

- [ ] **Step 5: Commit**

```bash
git add server/src/prompts/system-prompt.ts server/src/prompts/system-prompt.test.ts server/src/services/agent.service.ts
git commit -m "feat: system prompt accepts FlowPosition, delegates to category prompts"
```

---

## Task 5: Add skip_category to format_response + FormatResponseData

**Files:**

- Modify: `server/src/tools/definitions.ts`
- Modify: `server/src/services/AgentOrchestrator.ts`

- [ ] **Step 1: Add skip_category to format_response tool definition**

In `server/src/tools/definitions.ts`, find the `format_response` tool's `properties` and add:

```typescript
skip_category: {
  type: 'boolean',
  description:
    'Set to true when the user declines the current category (e.g., "No, I don\'t need a hotel"). The system will skip this category and move to the next.',
},
```

- [ ] **Step 2: Add skip_category to FormatResponseData**

In `server/src/services/AgentOrchestrator.ts`, update the `FormatResponseData` interface:

```typescript
export interface FormatResponseData {
  text: string;
  citations?: unknown[];
  quick_replies?: string[];
  skip_category?: boolean;
  advisory?: {
    severity: 'info' | 'warning' | 'critical';
    title: string;
    body: string;
  };
}
```

- [ ] **Step 3: Verify**

Run: `pnpm test && pnpm build`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add server/src/tools/definitions.ts server/src/services/AgentOrchestrator.ts
git commit -m "feat: add skip_category to format_response tool and FormatResponseData"
```

---

## Task 6: Update Chat Handler — Read/Write booking_state + Advance

**Files:**

- Modify: `server/src/handlers/chat/chat.ts`
- Modify: `server/src/handlers/chat/chat.test.ts`

- [ ] **Step 1: Write test for booking_state advancement**

Add to the POST describe in `server/src/handlers/chat/chat.test.ts`:

```typescript
it('advances booking_state after agent loop', async () => {
  const app = createApp();

  vi.mocked(tripRepo.getTripWithDetails)
    .mockResolvedValueOnce({
      id: tripId,
      user_id: userId,
      destination: 'Tokyo',
      origin: 'JFK',
      departure_date: '2026-07-01',
      return_date: '2026-07-10',
      budget_total: 5000,
      budget_currency: 'USD',
      travelers: 2,
      transport_mode: 'flying',
      flights: [],
      hotels: [],
      experiences: [],
      status: 'planning',
    } as never)
    // Post-loop reload: still no flights
    .mockResolvedValueOnce({
      id: tripId,
      user_id: userId,
      destination: 'Tokyo',
      origin: 'JFK',
      departure_date: '2026-07-01',
      return_date: '2026-07-10',
      budget_total: 5000,
      budget_currency: 'USD',
      travelers: 2,
      transport_mode: 'flying',
      flights: [],
      hotels: [],
      experiences: [],
      status: 'planning',
    } as never);

  vi.mocked(convRepo.getOrCreateConversation).mockResolvedValueOnce({
    id: convId,
    trip_id: tripId,
    booking_state: {
      flights: { status: 'asking' },
      hotels: { status: 'idle' },
      car_rental: { status: 'idle' },
      experiences: { status: 'idle' },
    },
  } as never);

  vi.mocked(convRepo.getMessagesByConversation).mockResolvedValueOnce([
    { id: uuid(3), role: 'user', content: 'Morning flights', sequence: 1 },
  ] as never);

  vi.mocked(convRepo.insertMessage).mockResolvedValue({
    id: uuid(4),
    conversation_id: convId,
    role: 'assistant',
    content: 'Here are flights',
    sequence: 2,
    created_at: '2026-01-01T00:00:00Z',
  } as never);

  // Agent searched flights
  vi.mocked(agentService.runAgentLoop).mockResolvedValueOnce({
    response: 'Here are flights',
    tool_calls: [
      { tool_name: 'search_flights', tool_id: 't1', input: {}, result: [] },
    ],
    total_tokens: { input: 100, output: 50 },
    nodes: [{ type: 'text' as const, content: 'Here are flights' }],
  });

  await request(app)
    .post(`/trips/${tripId}/chat`)
    .send({ message: 'Morning flights please' })
    .buffer(true)
    .parse((res, callback) => {
      let data = '';
      res.on('data', (chunk: Buffer) => {
        data += chunk.toString();
      });
      res.on('end', () => callback(null, data));
    });

  // Verify updateBookingState was called
  expect(convRepo.updateBookingState).toHaveBeenCalledWith(
    convId,
    expect.objectContaining({
      flights: expect.objectContaining({ status: 'presented' }),
    }),
  );
});
```

Also add the mock for `updateBookingState` at the top of the file with the other mocks. Add to the `vi.mock('app/repositories/conversations/conversations.js')` — since it's already mocked, just ensure `updateBookingState` is available as a mock function.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/handlers/chat/chat.test.ts`
Expected: FAIL — updateBookingState not called

- [ ] **Step 3: Update chat handler**

In `server/src/handlers/chat/chat.ts`:

Update imports:

```typescript
import {
  type BookingState,
  DEFAULT_BOOKING_STATE,
  advanceBookingState,
  getFlowPosition,
} from 'app/prompts/booking-steps.js';
import {
  getMessagesByConversation,
  getOrCreateConversation,
  insertMessage,
  updateBookingState,
} from 'app/repositories/conversations/conversations.js';
```

Remove the old `getBookingStep` import.

In the `chat` function, after loading the conversation, read `booking_state`:

```typescript
const bookingState: BookingState =
  conversation.booking_state ?? DEFAULT_BOOKING_STATE;
```

Replace `getBookingStep(...)` with:

```typescript
let flowPosition = getFlowPosition(
  { ...trip, transport_mode: trip.transport_mode ?? null, car_rentals: [] },
  bookingState,
);
```

If the flow position is a CATEGORY with status `idle`, promote to `asking`:

```typescript
let currentBookingState = structuredClone(bookingState);
if (flowPosition.phase === 'CATEGORY' && flowPosition.status === 'idle') {
  currentBookingState[flowPosition.category] = {
    ...currentBookingState[flowPosition.category],
    status: 'asking',
  };
  flowPosition = { ...flowPosition, status: 'asking' };
}
```

Pass `flowPosition` to `runAgentLoop` instead of `bookingStep`.

After the agent loop and trip reload, call `advanceBookingState`:

```typescript
if (updatedTrip && flowPosition.phase === 'CATEGORY') {
  const newBookingState = advanceBookingState(
    currentBookingState,
    flowPosition.category,
    flowPosition.status,
    result,
    {
      ...updatedTrip,
      transport_mode: updatedTrip.transport_mode ?? null,
      car_rentals: [],
    },
  );
  await updateBookingState(conversation.id, newBookingState);
}
```

Keep the existing COLLECT_DETAILS form injection logic (it checks the updated trip state after the loop).

- [ ] **Step 4: Run tests**

Run: `pnpm test && pnpm build`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add server/src/handlers/chat/chat.ts server/src/handlers/chat/chat.test.ts
git commit -m "feat: chat handler reads/writes booking_state, advances after agent loop"
```

---

## Task 7: Run Migration + Deploy

- [ ] **Step 1: Run migration on production**

```bash
cd server && DATABASE_URL=$(railway variables --json | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).DATABASE_URL)})" ) pnpm migrate:up
```

Expected: `1771879388556_add-booking-state` applies

- [ ] **Step 2: Push and deploy**

```bash
git push
railway up --detach
cd web-client && npx vercel --prod --yes
```

- [ ] **Step 3: Verify**

Check `https://server-production-f028.up.railway.app/health` returns `{"status":"ok"}`.

---

## Self-Review

**Spec coverage:**

- ✅ BookingState type with 4 categories, CategoryStatus type (Task 2)
- ✅ booking_state JSONB on conversations (Task 1)
- ✅ getFlowPosition() replaces getBookingStep() (Task 2)
- ✅ advanceBookingState() with all transitions (Task 2)
- ✅ Per-category prompts keyed by status (Task 3)
- ✅ COLLECT_DETAILS/CONFIRM unchanged (Task 4 — delegates to phase prompts)
- ✅ skip_category on format_response (Task 5)
- ✅ Chat handler reads/writes booking_state (Task 6)
- ✅ idle→asking promotion at start of turn (Task 6)
- ✅ Server-side transitions after agent loop (Task 6)
- ✅ updateBookingState repository function (Task 1)
- ✅ Tests for all functions (Tasks 2, 3, 4, 6)

**Placeholder scan:** No TBDs, TODOs, or incomplete steps.

**Type consistency:** `FlowPosition` used in booking-steps.ts, system-prompt.ts, agent.service.ts, chat.ts. `BookingState` used in booking-steps.ts, conversations.ts, chat.ts. `CategoryName` and `CategoryStatus` used in booking-steps.ts and category-prompts.ts. `advanceBookingState` signature matches usage in chat handler. All consistent.
