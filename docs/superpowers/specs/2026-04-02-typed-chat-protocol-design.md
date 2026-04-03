# Typed Chat Protocol Design

**Date:** 2026-04-02
**Status:** Approved
**Scope:** Refactor the chat engine from unstructured string messages to a type-safe, server-driven JSON message protocol with virtualized rendering.

---

## Problem

The current chat engine relies on regex-based content sniffing on the frontend to determine how to render messages. `parseTripFormFields()` scans for numbered lists, `parseItinerary()` looks for "Day N:" headers, `parseQuickReplies()` pattern-matches question phrases. There is no type contract — rendering is heuristic, fragile, and impossible to extend reliably.

## Decisions

1. **Discriminated union** `ChatNode` type in a shared pnpm workspace package
2. **Server-authoritative** node construction — Claude never sees or constructs display types
3. **Dual-column persistence** — `nodes` (JSONB) for display, `content` + `tool_calls_json` for Claude API conversation state
4. **Immutable message history** — once persisted, a message's `nodes` array is never rewritten; `schema_version` enables forward-compatible rendering
5. **Linear conversation** — `sequence` integer column with unique index, no branching, no linked list
6. **Stream text incrementally, emit structured nodes atomically** via typed SSE protocol
7. **`format_response` tool** — Claude provides structured metadata (text, citations, quick replies, advisories) as its final tool call each turn
8. **Auto-enrichment service** — server-triggered on destination changes, outside the agent loop
9. **TanStack Virtual** for chat virtualization with variable-height rows
10. **Car rentals** added as a core travel planning component
11. **Prompt consolidation** — clean, non-contradictory, no rendering hints
12. **Selections are trip state, not message state** — changing a flight/hotel/car selection mutates the trip record, not the message history

---

## Architecture

### Shared Types Package

New pnpm workspace package at `packages/shared-types/`. Both `server/` and `web-client/` depend on it.

#### ChatNode Discriminated Union

```typescript
interface Citation {
  id: string;
  label: string;
  url?: string;
  node_ref?: string;
  source_type:
    | 'travel_advisory'
    | 'visa_info'
    | 'weather'
    | 'vaccination'
    | 'general';
}

type ChatNode =
  | { type: 'text'; content: string; citations?: Citation[] }
  | { type: 'flight_tiles'; flights: Flight[]; selectable: boolean }
  | { type: 'hotel_tiles'; hotels: Hotel[]; selectable: boolean }
  | { type: 'car_rental_tiles'; rentals: CarRental[]; selectable: boolean }
  | { type: 'experience_tiles'; experiences: Experience[]; selectable: boolean }
  | { type: 'travel_plan_form'; fields: FormField[] }
  | { type: 'itinerary'; days: DayPlan[] }
  | {
      type: 'advisory';
      severity: 'info' | 'warning' | 'critical';
      title: string;
      body: string;
    }
  | { type: 'weather_forecast'; forecast: WeatherDay[] }
  | { type: 'budget_bar'; allocated: number; total: number; currency: string }
  | { type: 'quick_replies'; options: string[] }
  | {
      type: 'tool_progress';
      tool_name: string;
      tool_id: string;
      status: 'running' | 'done';
    };
```

Each tile type (Flight, Hotel, CarRental, Experience, FormField, DayPlan, WeatherDay) has its own interface defined in the shared package.

#### ChatMessage Envelope

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  nodes: ChatNode[];
  sequence: number;
  created_at: string;
}
```

User messages always contain a single `text` node. Assistant messages contain an ordered array of nodes.

#### SSE Event Types

```typescript
type SSEEvent =
  | { type: 'node'; node: ChatNode }
  | { type: 'text_delta'; content: string }
  | {
      type: 'tool_progress';
      tool_name: string;
      tool_id: string;
      status: 'running' | 'done';
    }
  | { type: 'done'; message: ChatMessage }
  | { type: 'error'; error: string };
```

- `text_delta` streams incrementally for the typing effect
- `node` emits atomically for structured content
- `done` carries the finalized message — the frontend replaces streaming state with this canonical version

---

### Server-Side Node Construction

Zero string parsing. Every node is constructed from explicit structured data. Three sources:

#### 1. Claude's Structured Output via `format_response` Tool

Claude always ends its turn by calling `format_response`:

```typescript
{
  tool: 'format_response',
  input: {
    text: string;                    // markdown response text
    citations?: Citation[];          // backing data for inline references
    quick_replies?: string[];        // suggested next actions
    advisory?: {                     // agent-escalated warning
      severity: 'info' | 'warning' | 'critical';
      title: string;
      body: string;
    };
  }
}
```

This is a tool call with a defined input schema — Claude must satisfy the contract.

#### 2. Tool Result Transformations

A node builder layer maps each tool result to its typed node:

```typescript
const nodeBuilders: Record<
  string,
  (result: unknown, context: TripContext) => ChatNode
> = {
  search_flights: (result, ctx) => ({
    type: 'flight_tiles',
    flights: normalize(result),
    selectable: true,
  }),
  search_car_rentals: (result, ctx) => ({
    type: 'car_rental_tiles',
    rentals: normalize(result),
    selectable: true,
  }),
  search_hotels: (result, ctx) => ({
    type: 'hotel_tiles',
    hotels: normalize(result),
    selectable: true,
  }),
  search_experiences: (result, ctx) => ({
    type: 'experience_tiles',
    experiences: normalize(result),
    selectable: true,
  }),
  calculate_remaining_budget: (result, ctx) => ({
    type: 'budget_bar',
    allocated: ctx.total_spent,
    total: ctx.budget_total,
    currency: ctx.budget_currency,
  }),
};
```

No interpretation — just shape mapping from structured API responses.

#### 3. Auto-Enrichments

Server-triggered when `update_trip` sets a destination. Runs outside the agent loop (no tool call budget consumed).

#### Node Assembly Order

For each assistant turn, the `ChatNode[]` array is assembled in this order:

1. Auto-enrichment nodes (advisory, weather — if destination just changed)
2. Tool result nodes (flight_tiles, car_rental_tiles, hotel_tiles, experience_tiles) in call order
3. Text node (from `format_response.text` + `format_response.citations`)
4. Budget bar node (if budget calculation occurred this turn)
5. Advisory node (from `format_response.advisory`, if agent escalated)
6. Quick replies node (from `format_response.quick_replies`)

---

### Auto-Enrichment Service

When `update_trip` is called with a destination, the server fires parallel enrichment fetches:

| Data Need                     | Source                 | Endpoint                                             | Node Type                 | License            |
| ----------------------------- | ---------------------- | ---------------------------------------------------- | ------------------------- | ------------------ |
| Advisory level (1-4)          | US State Dept          | `travel.state.gov/.../traveladvisories.json`         | `advisory`                | Public domain      |
| Safety + visa + health detail | UK FCDO                | `gov.uk/api/content/foreign-travel-advice/[country]` | `advisory`                | OGL v3.0           |
| Visa requirement matrix       | passport-index-dataset | GitHub CSV                                           | `advisory` (info)         | Check repo license |
| Weather forecast              | Open-Meteo             | `api.open-meteo.com/v1/forecast`                     | `weather_forecast`        | Free               |
| Vaccination requirements      | UK FCDO health section | Parsed from FCDO response                            | `advisory` (info/warning) | OGL v3.0           |
| Driving requirements          | Static JSON dataset    | Local file (driving side, IDP rules)                 | `advisory` (info)         | Curated            |

**Cache aggressively.** Advisory and visa data changes infrequently — cache for 24 hours. Weather data caches for 6 hours.

**Agent escalation.** Auto-enrichments handle baseline information. Claude escalates contextually via `format_response.advisory` when it detects risk factors (e.g., families with young children traveling to high-risk destinations, specific health conditions, political instability).

---

### Database Schema

#### Messages Table Changes

```sql
ALTER TABLE messages
  ADD COLUMN nodes JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN sequence INTEGER NOT NULL;

CREATE UNIQUE INDEX messages_conversation_sequence
  ON messages(conversation_id, sequence);
```

**Dual-column pattern:**

| Column            | Purpose                                          | Consumer                                        |
| ----------------- | ------------------------------------------------ | ----------------------------------------------- |
| `content`         | Claude's raw text response                       | Agent service (API conversation reconstruction) |
| `tool_calls_json` | Raw tool_use/tool_result blocks                  | Agent service (API conversation reconstruction) |
| `nodes`           | Ordered `ChatNode[]` for UI rendering            | Frontend                                        |
| `schema_version`  | Shape version for forward-compatible rendering   | Frontend                                        |
| `sequence`        | Strict ordering within conversation              | Both                                            |
| `role`            | `'user'` or `'assistant'` only (remove `'tool'`) | Both                                            |

**Immutability:** Once a message is persisted, its `nodes` array is never rewritten. `schema_version` tells the frontend which shape to expect. Old messages render with their original shape; the frontend handles missing fields gracefully.

**Why two representations:** `nodes` is a UI concern (what was displayed). `content` + `tool_calls_json` is a conversation concern (what Claude needs to continue reasoning). These are separate concerns that evolve independently.

#### Migration Strategy

1. Add new columns (`nodes`, `schema_version`, `sequence`)
2. Backfill `nodes` for existing rows by running through the node builder
3. Backfill `sequence` from `created_at` ordering
4. Merge orphaned `role='tool'` rows into parent assistant messages
5. Drop `'tool'` from `message_role` enum

#### Schema & Migrations README

A `README.md` in the migrations directory documents:

- The dual-column pattern and why it exists
- The `sequence` ordering contract (strictly linear, no branching)
- The `schema_version` contract (messages are immutable snapshots)
- The `ChatNode` types inventory with required fields per type
- Migration procedures for adding new node types

---

### SSE Protocol

#### Event Flow for a Single Turn

```
POST /trips/:id/chat
  Body: { "message": "Find me flights to Tokyo" }

→ Server persists user message, opens SSE stream

event: tool_progress
data: { "type": "tool_progress", "tool_name": "update_trip", "tool_id": "t1", "status": "running" }

event: tool_progress
data: { "type": "tool_progress", "tool_id": "t1", "status": "done" }

event: node
data: { "type": "node", "node": { "type": "advisory", "severity": "info", ... } }

event: node
data: { "type": "node", "node": { "type": "weather_forecast", ... } }

event: tool_progress
data: { "type": "tool_progress", "tool_name": "search_flights", "tool_id": "t2", "status": "running" }

event: tool_progress
data: { "type": "tool_progress", "tool_id": "t2", "status": "done" }

event: node
data: { "type": "node", "node": { "type": "flight_tiles", "flights": [...], "selectable": true } }

event: text_delta
data: { "type": "text_delta", "content": "I found " }

event: text_delta
data: { "type": "text_delta", "content": "several great flight options..." }

event: done
data: { "type": "done", "message": { "id": "...", "role": "assistant", "nodes": [...], "sequence": 4, "created_at": "..." } }
```

The `done` event is the reconciliation point. During streaming, the frontend builds a working set of nodes from individual events. When `done` arrives, it replaces everything with the server's authoritative version.

---

### Prompt Architecture

#### System Prompt

Claude's identity and behavioral rules. Consolidated, no contradictions:

- Identity: travel planning agent
- Planning order: flights → car rentals → hotels → experiences (budget-aware, calculate remaining between each)
- Call `update_trip` immediately when destination/dates/budget are established
- Always end turn with `format_response` — provide text, citations, quick replies, optional advisory escalation
- Max 15 tool calls per turn
- Tone and personality guidance
- No rendering hints, no formatting instructions for UI

#### Trip Context

Injected dynamically. Pure data, no behavioral instructions:

- Current trip state (destination, dates, budget, travelers, preferences)
- Current selections (flights, car rental, hotel, experiences)
- Budget spending breakdown
- No overlap with system prompt

#### Tool Definitions

8 tools total:

1. `search_flights` — SerpApi Google Flights
2. `search_car_rentals` — SerpApi Google Car Rentals (new)
3. `search_hotels` — SerpApi Google Hotels
4. `search_experiences` — Google Places Text Search
5. `calculate_remaining_budget` — local computation
6. `get_destination_info` — IATA codes, timezone (stays as agent tool; weather moved to auto-enrichment)
7. `update_trip` — persist trip details
8. `format_response` — structured response metadata (text, citations, quick replies, advisory) (new)

Each tool definition has a clear, non-contradictory description with explicit input schema.

---

### Frontend Architecture

#### Component Registry

```typescript
const nodeComponents: Record<ChatNode['type'], React.ComponentType<any>> = {
  text: MarkdownText,
  flight_tiles: FlightTiles,
  hotel_tiles: HotelTiles,
  car_rental_tiles: CarRentalTiles,
  experience_tiles: ExperienceTiles,
  travel_plan_form: TravelPlanForm,
  itinerary: ItineraryTimeline,
  advisory: AdvisoryCard,
  weather_forecast: WeatherForecast,
  budget_bar: BudgetBar,
  quick_replies: QuickReplyChips,
  tool_progress: ToolProgressIndicator,
};

function NodeRenderer({ node }: { node: ChatNode }) {
  const Component = nodeComponents[node.type];
  return <Component {...node} />;
}
```

TypeScript enforces exhaustiveness — adding a node type to the union without adding a component produces a compile error.

#### MarkdownText Component

All text nodes render through `react-markdown`. No raw string rendering path. Supports:

- Standard markdown (bold, italic, lists, headers, links)
- Citation markers (`[1]`, `[visa requirements]`) rendered as interactive links
- External citation URLs open in new tab
- `node_ref` citations scroll to the referenced node in the chat

#### Virtualized Chat (TanStack Virtual)

- `useVirtualizer` with `estimateSize` based on node types
- `measureElement` ref callback for dynamic height measurement after render
- Overscan of ~3 messages for smooth scrolling
- Auto-scroll to bottom on new messages
- "Scroll to bottom" button when user has scrolled up
- Each virtualized row is a message; each message renders its `nodes` array via `NodeRenderer`

#### Streaming State

During an active turn:

1. `text_delta` events accumulate into a temporary text node
2. `node` events append to a temporary working node array
3. `tool_progress` events update a loading indicator
4. `done` event replaces all temporary state with the persisted `ChatMessage`
5. TanStack Query invalidation refreshes the full message list

#### Selection UX

Tile nodes (flights, hotels, car rentals, experiences) are display records — what was shown. Selections are trip-level state — what was chosen. The frontend highlights the currently-selected option across all tile nodes in the conversation. Changing a selection (even from an older message) updates the trip record, not the message. Selecting a different car from a previous search is always possible without branching or re-searching — unless the user wants new options, in which case Claude searches again.

---

### Removed

The following are deleted with no replacement:

- `parseTripFormFields()` — regex form detection in `TripDetailsForm.tsx`
- `parseItinerary()` — regex itinerary detection in `ItineraryTimeline.tsx`
- `parseQuickReplies()` — regex quick reply detection in `QuickReplyChips.tsx`
- `renderText()` — inline bold/newline text renderer in `ChatBox.tsx`
- `'tool'` message role — tool results fold into assistant messages
- All rendering hints in system/trip-context prompts

---

## Rollout Phases

### Phase 1: Foundation

- Create `packages/shared-types/` with ChatNode union, ChatMessage, SSE event types
- Wire pnpm workspace dependencies

### Phase 2: Server

- Node builder layer (tool result → typed node)
- Auto-enrichment service (FCDO, State Dept, Open-Meteo, passport-index, static driving data)
- `format_response` tool definition
- `search_car_rentals` tool
- Consolidated system prompt and trip context prompt
- Updated SSE emission with typed event protocol

### Phase 3: Database Migration

- Add `nodes`, `schema_version`, `sequence` columns
- Backfill existing messages
- Merge tool-role rows, drop tool role from enum
- Write schema/migrations README

### Phase 4: Frontend

- `NodeRenderer` component with registry
- Individual node components (MarkdownText, AdvisoryCard, WeatherForecast, CarRentalTiles, etc.)
- Virtualized chat with TanStack Virtual
- Typed SSE event handling
- Remove all regex parsers
- Install `react-markdown`

### Phase 5: Verification

- Unit tests for node builders, enrichment service, prompt construction
- Integration tests for full chat flow (message → SSE → typed nodes)
- Frontend component tests for each node type
- End-to-end smoke test: complete trip planning conversation
