# Typed Chat Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the chat engine from regex-based string parsing to a type-safe, server-driven JSON message protocol with discriminated union nodes, virtualized rendering, auto-enrichment, and car rental support.

**Architecture:** A shared types package (`packages/shared-types/`) defines a `ChatNode` discriminated union and `ChatMessage` envelope consumed by both server and frontend. The server is the sole authority for constructing nodes — Claude provides structured metadata via a `format_response` tool, tool results are mechanically mapped to typed nodes, and an auto-enrichment service provides travel advisories/weather/visa info. The frontend renders nodes via a component registry with TanStack Virtual for chat virtualization.

**Tech Stack:** TypeScript, pnpm workspaces, Express 5, Next.js 15, TanStack Query, TanStack Virtual, react-markdown, Anthropic Claude API, SerpApi, Open-Meteo API, UK FCDO GOV.UK Content API, US State Dept travel advisories JSON, PostgreSQL (Neon), Redis (ioredis)

**Design Spec:** `docs/superpowers/specs/2026-04-02-typed-chat-protocol-design.md`

---

## File Structure

### New Files

```
packages/shared-types/
  package.json
  tsconfig.json
  src/
    index.ts                          # barrel export
    nodes.ts                          # ChatNode union, all tile/data interfaces
    messages.ts                       # ChatMessage envelope
    events.ts                         # SSE event types

server/src/
  services/node-builder.ts            # tool result → ChatNode mapping
  services/enrichment.ts              # auto-enrichment service (FCDO, State Dept, Open-Meteo, etc.)
  services/enrichment-sources/
    fcdo.ts                           # UK FCDO GOV.UK Content API client
    state-dept.ts                     # US State Dept advisories JSON client
    open-meteo.ts                     # Open-Meteo weather API client
    visa-matrix.ts                    # passport-index CSV lookup
    driving.ts                        # static driving requirements dataset
  tools/car-rentals.tool.ts           # SerpApi car rental search
  tools/format-response.tool.ts       # format_response tool handler
  data/driving-requirements.json      # static dataset: driving side, IDP rules by country
  migrations/TIMESTAMP_add-typed-chat-columns.js
  migrations/TIMESTAMP_create-trip-car-rentals-table.js
  migrations/README.md                # schema documentation

web-client/src/components/ChatBox/
  NodeRenderer.tsx                    # component registry dispatcher
  nodes/
    MarkdownText.tsx                  # react-markdown based text renderer
    MarkdownText.module.scss
    AdvisoryCard.tsx                  # travel advisory display
    AdvisoryCard.module.scss
    WeatherForecast.tsx               # multi-day weather display
    WeatherForecast.module.scss
    CarRentalCard.tsx                 # individual car rental card
    CarRentalCard.module.scss
    CarRentalTiles.tsx                # car rental tile list with SelectableCardGroup
    BudgetBar.tsx                     # replaces InlineBudgetBar (same logic, new import path)
    ToolProgressIndicator.tsx         # replaces inline tool progress rendering
  VirtualizedChat.tsx                 # TanStack Virtual wrapper
  VirtualizedChat.module.scss
  useSSEChat.ts                       # typed SSE event handling hook (extracted from ChatBox)
```

### Modified Files

```
pnpm-workspace.yaml                  # add packages/shared-types
server/package.json                   # add shared-types dependency
web-client/package.json               # add shared-types, @tanstack/react-virtual, react-markdown deps
server/tsconfig.json                  # add path alias for shared-types
web-client/tsconfig.json              # add path alias for shared-types

server/src/tools/definitions.ts       # add search_car_rentals + format_response definitions
server/src/tools/executor.ts          # add search_car_rentals + format_response routing
server/src/prompts/system-prompt.ts   # consolidated prompt, no rendering hints
server/src/prompts/trip-context.ts    # pure data, no behavioral instructions, add car rental
server/src/services/AgentOrchestrator.ts  # emit typed SSE events, collect nodes
server/src/services/agent.service.ts  # node assembly, enrichment integration
server/src/handlers/chat/chat.ts      # typed SSE protocol, dual-column persistence
server/src/repositories/conversations/conversations.ts  # add nodes, schema_version, sequence columns

web-client/src/components/ChatBox/ChatBox.tsx  # gutted: delegates to VirtualizedChat + useSSEChat
web-client/src/components/ChatBox/ChatBox.module.scss  # updated for virtualized layout
```

### Deleted (after migration complete)

```
web-client/src/components/ChatBox/TripDetailsForm.tsx  →  parseTripFormFields() and parseSubmittedValues() removed
web-client/src/components/ChatBox/widgets/ItineraryTimeline.tsx  →  parseItinerary() removed
web-client/src/components/ChatBox/widgets/QuickReplyChips.tsx  →  parseQuickReplies() removed
```

Note: The components themselves (TripDetailsForm, ItineraryTimeline, QuickReplyChips) are kept — only the regex parser functions are removed. The components become node renderers mapped via the registry.

---

## Task 1: Shared Types Package

**Files:**
- Create: `packages/shared-types/package.json`
- Create: `packages/shared-types/tsconfig.json`
- Create: `packages/shared-types/src/nodes.ts`
- Create: `packages/shared-types/src/messages.ts`
- Create: `packages/shared-types/src/events.ts`
- Create: `packages/shared-types/src/index.ts`
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: Create package.json for shared-types**

```json
{
  "name": "@agentic-travel-agent/shared-types",
  "version": "1.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 2: Create tsconfig.json for shared-types**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create nodes.ts with all ChatNode types**

```typescript
// --- Citation ---

export interface Citation {
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

// --- Tile data interfaces ---

export interface Flight {
  id: string;
  airline: string;
  airline_logo?: string;
  flight_number: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time?: string;
  price: number;
  currency: string;
  cabin_class?: string;
}

export interface Hotel {
  id: string;
  name: string;
  city: string;
  image_url?: string;
  star_rating: number;
  price_per_night: number;
  total_price: number;
  currency: string;
  check_in: string;
  check_out: string;
  lat?: number;
  lon?: number;
}

export interface CarRental {
  id: string;
  provider: string;
  provider_logo?: string;
  car_name: string;
  car_type: string; // 'economy' | 'compact' | 'midsize' | 'suv' | 'luxury' | 'van'
  price_per_day: number;
  total_price: number;
  currency: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  dropoff_date: string;
  features: string[]; // e.g. ['Automatic', 'AC', '5 seats', '2 bags']
  image_url?: string;
}

export interface Experience {
  id: string;
  name: string;
  category: string;
  photo_ref?: string;
  rating?: number;
  estimated_cost: number;
  currency?: string;
  lat?: number;
  lon?: number;
}

export interface FormField {
  name: string;
  label: string;
  field_type: 'text' | 'date' | 'number' | 'select';
  placeholder?: string;
  required: boolean;
  options?: string[];
  default_value?: string;
}

export interface DayPlan {
  day: number;
  title: string;
  items: string[];
}

export interface WeatherDay {
  date: string;
  high_c: number;
  low_c: number;
  high_f: number;
  low_f: number;
  condition: string;
  icon: string; // emoji or icon identifier
  precipitation_chance: number;
}

// --- ChatNode discriminated union ---

export type ChatNode =
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
  | {
      type: 'budget_bar';
      allocated: number;
      total: number;
      currency: string;
    }
  | { type: 'quick_replies'; options: string[] }
  | {
      type: 'tool_progress';
      tool_name: string;
      tool_id: string;
      status: 'running' | 'done';
    };

// --- Helper type to extract a specific node ---

export type ChatNodeOfType<T extends ChatNode['type']> = Extract<
  ChatNode,
  { type: T }
>;
```

- [ ] **Step 4: Create messages.ts**

```typescript
import type { ChatNode } from './nodes.js';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  nodes: ChatNode[];
  sequence: number;
  created_at: string;
}
```

- [ ] **Step 5: Create events.ts**

```typescript
import type { ChatNode } from './nodes.js';
import type { ChatMessage } from './messages.js';

export type SSEEvent =
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

- [ ] **Step 6: Create index.ts barrel export**

```typescript
export * from './nodes.js';
export * from './messages.js';
export * from './events.js';
```

- [ ] **Step 7: Add shared-types to pnpm workspace**

Update `pnpm-workspace.yaml`:

```yaml
packages:
  - 'server'
  - 'web-client'
  - 'packages/shared-types'
```

- [ ] **Step 8: Add shared-types dependency to server and web-client**

In `server/package.json`, add to dependencies:
```json
"@agentic-travel-agent/shared-types": "workspace:*"
```

In `web-client/package.json`, add to dependencies:
```json
"@agentic-travel-agent/shared-types": "workspace:*"
```

Run: `pnpm install`

- [ ] **Step 9: Verify typecheck passes**

Run: `cd packages/shared-types && pnpm typecheck`
Expected: No errors

- [ ] **Step 10: Commit**

```bash
git add packages/shared-types/ pnpm-workspace.yaml server/package.json web-client/package.json pnpm-lock.yaml
git commit -m "feat: add shared-types workspace package with ChatNode union, ChatMessage, SSE events"
```

---

## Task 2: Database Migration — Typed Chat Columns

**Files:**
- Create: `server/migrations/TIMESTAMP_add-typed-chat-columns.js`
- Modify: `server/src/repositories/conversations/conversations.ts`

- [ ] **Step 1: Create migration file**

Use the next timestamp after existing migrations. The latest is `1771879388552`. Use `1771879388553`.

Create `server/migrations/1771879388553_add-typed-chat-columns.js`:

```javascript
exports.up = (pgm) => {
  pgm.addColumns('messages', {
    nodes: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'[]'::jsonb"),
    },
    schema_version: {
      type: 'integer',
      notNull: true,
      default: 1,
    },
    sequence: {
      type: 'integer',
    },
  });

  // Backfill sequence from created_at ordering per conversation
  pgm.sql(`
    WITH numbered AS (
      SELECT id, conversation_id,
        ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY created_at) AS seq
      FROM messages
    )
    UPDATE messages SET sequence = numbered.seq
    FROM numbered WHERE messages.id = numbered.id
  `);

  // Now make sequence NOT NULL
  pgm.alterColumn('messages', 'sequence', { notNull: true });

  // Backfill nodes for existing text messages
  pgm.sql(`
    UPDATE messages
    SET nodes = jsonb_build_array(
      jsonb_build_object('type', 'text', 'content', COALESCE(content, ''))
    )
    WHERE role IN ('user', 'assistant') AND content IS NOT NULL
  `);

  pgm.createIndex('messages', ['conversation_id', 'sequence'], {
    unique: true,
    name: 'messages_conversation_sequence',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('messages', ['conversation_id', 'sequence'], {
    name: 'messages_conversation_sequence',
  });
  pgm.dropColumns('messages', ['nodes', 'schema_version', 'sequence']);
};
```

- [ ] **Step 2: Update conversations repository interfaces**

In `server/src/repositories/conversations/conversations.ts`, update the `Message` interface:

Replace the existing `Message` interface (lines 10-19) with:

```typescript
export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string | null;
  tool_calls_json: unknown;
  nodes: ChatNode[];
  schema_version: number;
  sequence: number;
  token_count: number | null;
  created_at: string;
}
```

Add import at top:
```typescript
import type { ChatNode } from '@agentic-travel-agent/shared-types';
```

Update `InsertMessageInput` to include the new fields:

```typescript
export interface InsertMessageInput {
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string | null;
  tool_calls_json?: unknown;
  nodes: ChatNode[];
  schema_version?: number;
  token_count?: number | null;
}
```

- [ ] **Step 3: Update insertMessage to handle new columns**

Update the `insertMessage` function to include `nodes`, `schema_version`, and auto-increment `sequence`:

```typescript
export async function insertMessage(input: InsertMessageInput): Promise<Message> {
  const { rows } = await pool.query<Message>(
    `INSERT INTO messages (conversation_id, role, content, tool_calls_json, nodes, schema_version, sequence, token_count)
     VALUES ($1, $2, $3, $4, $5, $6,
       (SELECT COALESCE(MAX(sequence), 0) + 1 FROM messages WHERE conversation_id = $1),
       $7)
     RETURNING *`,
    [
      input.conversation_id,
      input.role,
      input.content,
      input.tool_calls_json ? JSON.stringify(input.tool_calls_json) : null,
      JSON.stringify(input.nodes),
      input.schema_version ?? 1,
      input.token_count ?? null,
    ],
  );
  return rows[0];
}
```

- [ ] **Step 4: Run migration**

Run: `cd server && pnpm migrate:up`
Expected: Migration applies successfully

- [ ] **Step 5: Commit**

```bash
git add server/migrations/1771879388553_add-typed-chat-columns.js server/src/repositories/conversations/conversations.ts
git commit -m "feat: add nodes, schema_version, sequence columns to messages table"
```

---

## Task 3: Database Migration — Car Rentals Table

**Files:**
- Create: `server/migrations/1771879388554_create-trip-car-rentals-table.js`

- [ ] **Step 1: Create car rentals migration**

Create `server/migrations/1771879388554_create-trip-car-rentals-table.js`:

```javascript
exports.up = (pgm) => {
  pgm.createTable('trip_car_rentals', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    trip_id: {
      type: 'uuid',
      notNull: true,
      references: 'trips',
      onDelete: 'CASCADE',
    },
    provider: { type: 'text', notNull: true },
    car_name: { type: 'text', notNull: true },
    car_type: { type: 'text', notNull: true },
    price_per_day: { type: 'numeric(10,2)', notNull: true },
    total_price: { type: 'numeric(10,2)', notNull: true },
    currency: { type: 'varchar(3)', notNull: true, default: 'USD' },
    pickup_location: { type: 'text' },
    dropoff_location: { type: 'text' },
    pickup_date: { type: 'date' },
    dropoff_date: { type: 'date' },
    features: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    image_url: { type: 'text' },
    data_json: { type: 'jsonb' },
    selected: { type: 'boolean', notNull: true, default: false },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('trip_car_rentals', 'trip_id');
};

exports.down = (pgm) => {
  pgm.dropTable('trip_car_rentals');
};
```

- [ ] **Step 2: Run migration**

Run: `cd server && pnpm migrate:up`
Expected: Migration applies successfully

- [ ] **Step 3: Commit**

```bash
git add server/migrations/1771879388554_create-trip-car-rentals-table.js
git commit -m "feat: add trip_car_rentals table for car rental selections"
```

---

## Task 4: Migrations README

**Files:**
- Create: `server/migrations/README.md`

- [ ] **Step 1: Write the schema documentation**

Create `server/migrations/README.md`:

```markdown
# Database Schema — Chat Data Structure

## Messages Table

The messages table uses a **dual-column pattern** separating display state from conversation state.

### Columns

| Column | Type | Purpose | Consumer |
|--------|------|---------|----------|
| `id` | UUID | Primary key | Both |
| `conversation_id` | UUID | FK to conversations | Both |
| `role` | ENUM('user','assistant') | Message author | Both |
| `content` | TEXT | Claude's raw text response | Agent service (API conversation reconstruction) |
| `tool_calls_json` | JSONB | Raw tool_use/tool_result blocks | Agent service (API conversation reconstruction) |
| `nodes` | JSONB | Ordered `ChatNode[]` for UI rendering | Frontend |
| `schema_version` | INTEGER | Shape version for forward-compatible rendering | Frontend |
| `sequence` | INTEGER | Strict ordering within conversation | Both |
| `token_count` | INTEGER | Input + output tokens consumed | Observability |
| `created_at` | TIMESTAMPTZ | Insertion timestamp | Both |

### Why Two Representations

- **`nodes`** is a UI concern — what was displayed to the user.
- **`content` + `tool_calls_json`** is a conversation concern — what Claude needs to continue reasoning.

These are separate concerns that evolve independently. The frontend never reads `content` or `tool_calls_json`. The agent service never reads `nodes`.

### Immutability

Once a message is persisted, its `nodes` array is **never rewritten**. Messages are immutable snapshots. The `schema_version` field tells the frontend which shape to expect — the frontend handles missing fields gracefully for older schema versions.

### Ordering

Messages are ordered by `sequence` (INTEGER) within a conversation. There is a unique index on `(conversation_id, sequence)`. Conversations are **strictly linear** — no branching, no linked list, no parent references. Sequence is auto-incremented on insert.

### ChatNode Types

The `nodes` JSONB column contains an ordered array of `ChatNode` objects. Each node has a `type` discriminator:

| Type | Description | Selectable |
|------|-------------|------------|
| `text` | Markdown content with optional citations | No |
| `flight_tiles` | Flight search results | Yes |
| `hotel_tiles` | Hotel search results | Yes |
| `car_rental_tiles` | Car rental search results | Yes |
| `experience_tiles` | Experience/activity search results | Yes |
| `travel_plan_form` | Structured form for trip details | No |
| `itinerary` | Day-by-day plan | No |
| `advisory` | Travel advisories, visa/vaccination info | No |
| `weather_forecast` | Multi-day weather outlook | No |
| `budget_bar` | Budget allocation tracker | No |
| `quick_replies` | Suggested response buttons | No |
| `tool_progress` | Tool execution status indicator | No |

Full type definitions are in `packages/shared-types/src/nodes.ts`.

### Adding New Node Types

1. Add the type to the `ChatNode` union in `packages/shared-types/src/nodes.ts`
2. Add a node builder in `server/src/services/node-builder.ts` (if derived from a tool result)
3. Add a React component and register it in `web-client/src/components/ChatBox/NodeRenderer.tsx`
4. TypeScript will enforce exhaustiveness — the frontend won't compile until the component is registered

No database migration is needed — `nodes` is JSONB and accepts any valid ChatNode shape.

### Related Tables

- **`conversations`** — one per trip, links trip to message history
- **`tool_call_log`** — observability log for every tool invocation (separate from display)
- **`trip_flights`**, **`trip_hotels`**, **`trip_car_rentals`**, **`trip_experiences`** — selection state (what the user chose, mutable)
```

- [ ] **Step 2: Commit**

```bash
git add server/migrations/README.md
git commit -m "docs: add migrations README documenting dual-column pattern and chat data structure"
```

---

## Task 5: Node Builder Layer

**Files:**
- Create: `server/src/services/node-builder.ts`
- Create: `server/src/services/node-builder.test.ts`

- [ ] **Step 1: Write tests for node builder**

Create `server/src/services/node-builder.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildNodeFromToolResult } from './node-builder.js';
import type { ChatNode } from '@agentic-travel-agent/shared-types';

describe('buildNodeFromToolResult', () => {
  it('maps search_flights result to flight_tiles node', () => {
    const result = {
      flights: [
        {
          airline: 'Delta',
          airline_logo: 'https://logo.com/delta.png',
          flight_number: 'DL123',
          departure_airport: 'JFK',
          arrival_airport: 'NRT',
          departure_time: '2026-05-01T08:00:00',
          arrival_time: '2026-05-02T12:00:00',
          price: 850,
          currency: 'USD',
        },
      ],
    };

    const node = buildNodeFromToolResult('search_flights', result);
    expect(node).not.toBeNull();
    expect(node!.type).toBe('flight_tiles');
    if (node!.type === 'flight_tiles') {
      expect(node!.flights).toHaveLength(1);
      expect(node!.flights[0].airline).toBe('Delta');
      expect(node!.flights[0].origin).toBe('JFK');
      expect(node!.flights[0].destination).toBe('NRT');
      expect(node!.selectable).toBe(true);
    }
  });

  it('maps search_hotels result to hotel_tiles node', () => {
    const result = {
      hotels: [
        {
          name: 'Tokyo Grand',
          city: 'Tokyo',
          star_rating: 4,
          price_per_night: 120,
          total_price: 840,
          currency: 'USD',
          check_in: '2026-05-01',
          check_out: '2026-05-08',
        },
      ],
    };

    const node = buildNodeFromToolResult('search_hotels', result);
    expect(node).not.toBeNull();
    expect(node!.type).toBe('hotel_tiles');
    if (node!.type === 'hotel_tiles') {
      expect(node!.hotels).toHaveLength(1);
      expect(node!.hotels[0].name).toBe('Tokyo Grand');
      expect(node!.selectable).toBe(true);
    }
  });

  it('maps search_car_rentals result to car_rental_tiles node', () => {
    const result = {
      rentals: [
        {
          provider: 'Hertz',
          car_name: 'Toyota Corolla',
          car_type: 'compact',
          price_per_day: 45,
          total_price: 315,
          currency: 'USD',
          pickup_location: 'NRT Airport',
          dropoff_location: 'NRT Airport',
          pickup_date: '2026-05-01',
          dropoff_date: '2026-05-08',
          features: ['Automatic', 'AC', '5 seats'],
        },
      ],
    };

    const node = buildNodeFromToolResult('search_car_rentals', result);
    expect(node).not.toBeNull();
    expect(node!.type).toBe('car_rental_tiles');
    if (node!.type === 'car_rental_tiles') {
      expect(node!.rentals).toHaveLength(1);
      expect(node!.rentals[0].provider).toBe('Hertz');
      expect(node!.selectable).toBe(true);
    }
  });

  it('maps search_experiences result to experience_tiles node', () => {
    const result = {
      experiences: [
        {
          name: 'Senso-ji Temple',
          category: 'Temple',
          rating: 4.6,
          estimated_cost: 0,
        },
      ],
    };

    const node = buildNodeFromToolResult('search_experiences', result);
    expect(node).not.toBeNull();
    expect(node!.type).toBe('experience_tiles');
  });

  it('maps calculate_remaining_budget to budget_bar node', () => {
    const result = {
      total_budget: 3000,
      total_spent: 1850,
      remaining: 1150,
      currency: 'USD',
    };

    const node = buildNodeFromToolResult('calculate_remaining_budget', result);
    expect(node).not.toBeNull();
    expect(node!.type).toBe('budget_bar');
    if (node!.type === 'budget_bar') {
      expect(node!.allocated).toBe(1850);
      expect(node!.total).toBe(3000);
      expect(node!.currency).toBe('USD');
    }
  });

  it('returns null for tools without a node mapping (update_trip, get_destination_info)', () => {
    expect(buildNodeFromToolResult('update_trip', {})).toBeNull();
    expect(buildNodeFromToolResult('get_destination_info', {})).toBeNull();
    expect(buildNodeFromToolResult('format_response', {})).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/services/node-builder.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement node builder**

Create `server/src/services/node-builder.ts`:

```typescript
import { randomUUID } from 'crypto';
import type { ChatNode, Flight, Hotel, CarRental, Experience } from '@agentic-travel-agent/shared-types';

interface FlightRaw {
  airline: string;
  airline_logo?: string;
  flight_number: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  arrival_time?: string;
  price: number;
  currency: string;
  cabin_class?: string;
}

interface HotelRaw {
  name: string;
  city: string;
  image_url?: string;
  star_rating: number;
  price_per_night: number;
  total_price: number;
  currency: string;
  check_in: string;
  check_out: string;
  lat?: number;
  lon?: number;
}

interface CarRentalRaw {
  provider: string;
  provider_logo?: string;
  car_name: string;
  car_type: string;
  price_per_day: number;
  total_price: number;
  currency: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  dropoff_date: string;
  features: string[];
  image_url?: string;
}

interface ExperienceRaw {
  name: string;
  category: string;
  photo_ref?: string;
  rating?: number;
  estimated_cost: number;
  currency?: string;
  lat?: number;
  lon?: number;
}

function normalizeFlights(raw: FlightRaw[]): Flight[] {
  return raw.map((f) => ({
    id: randomUUID(),
    airline: f.airline,
    airline_logo: f.airline_logo,
    flight_number: f.flight_number,
    origin: f.departure_airport,
    destination: f.arrival_airport,
    departure_time: f.departure_time,
    arrival_time: f.arrival_time,
    price: f.price,
    currency: f.currency,
    cabin_class: f.cabin_class,
  }));
}

function normalizeHotels(raw: HotelRaw[]): Hotel[] {
  return raw.map((h) => ({
    id: randomUUID(),
    name: h.name,
    city: h.city,
    image_url: h.image_url,
    star_rating: h.star_rating,
    price_per_night: h.price_per_night,
    total_price: h.total_price,
    currency: h.currency,
    check_in: h.check_in,
    check_out: h.check_out,
    lat: h.lat,
    lon: h.lon,
  }));
}

function normalizeCarRentals(raw: CarRentalRaw[]): CarRental[] {
  return raw.map((c) => ({
    id: randomUUID(),
    provider: c.provider,
    provider_logo: c.provider_logo,
    car_name: c.car_name,
    car_type: c.car_type,
    price_per_day: c.price_per_day,
    total_price: c.total_price,
    currency: c.currency,
    pickup_location: c.pickup_location,
    dropoff_location: c.dropoff_location,
    pickup_date: c.pickup_date,
    dropoff_date: c.dropoff_date,
    features: c.features ?? [],
    image_url: c.image_url,
  }));
}

function normalizeExperiences(raw: ExperienceRaw[]): Experience[] {
  return raw.map((e) => ({
    id: randomUUID(),
    name: e.name,
    category: e.category,
    photo_ref: e.photo_ref,
    rating: e.rating,
    estimated_cost: e.estimated_cost,
    currency: e.currency,
    lat: e.lat,
    lon: e.lon,
  }));
}

export function buildNodeFromToolResult(
  toolName: string,
  result: unknown,
): ChatNode | null {
  const data = result as Record<string, unknown>;

  switch (toolName) {
    case 'search_flights':
      return {
        type: 'flight_tiles',
        flights: normalizeFlights((data.flights as FlightRaw[]) ?? []),
        selectable: true,
      };

    case 'search_hotels':
      return {
        type: 'hotel_tiles',
        hotels: normalizeHotels((data.hotels as HotelRaw[]) ?? []),
        selectable: true,
      };

    case 'search_car_rentals':
      return {
        type: 'car_rental_tiles',
        rentals: normalizeCarRentals((data.rentals as CarRentalRaw[]) ?? []),
        selectable: true,
      };

    case 'search_experiences':
      return {
        type: 'experience_tiles',
        experiences: normalizeExperiences(
          (data.experiences as ExperienceRaw[]) ?? [],
        ),
        selectable: true,
      };

    case 'calculate_remaining_budget':
      return {
        type: 'budget_bar',
        allocated: (data.total_spent as number) ?? 0,
        total: (data.total_budget as number) ?? 0,
        currency: (data.currency as string) ?? 'USD',
      };

    default:
      return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run src/services/node-builder.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/services/node-builder.ts server/src/services/node-builder.test.ts
git commit -m "feat: add node builder layer for tool result → ChatNode mapping"
```

---

## Task 6: Car Rentals Tool

**Files:**
- Create: `server/src/tools/car-rentals.tool.ts`
- Create: `server/src/tools/car-rentals.tool.test.ts`
- Modify: `server/src/tools/definitions.ts`
- Modify: `server/src/tools/executor.ts`

- [ ] **Step 1: Write car rental tool test**

Create `server/src/tools/car-rentals.tool.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchCarRentals } from './car-rentals.tool.js';

vi.mock('app/lib/redis', () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
}));

describe('searchCarRentals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an object with rentals array', async () => {
    // Mock fetch for SerpApi
    const mockResponse = {
      cars_results: [
        {
          vehicle_info: {
            name: 'Toyota Corolla or similar',
            class: 'Compact',
          },
          price: { total: 315, per_day: 45, currency: 'USD' },
          rental_company: { name: 'Hertz', logo: 'https://logo.com/hertz.png' },
          pickup_location: 'NRT Airport',
          dropoff_location: 'NRT Airport',
          features: ['Automatic', 'Air Conditioning', '5 Seats'],
          vehicle_image: 'https://img.com/corolla.jpg',
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await searchCarRentals({
      pickup_location: 'Tokyo',
      pickup_date: '2026-05-01',
      dropoff_date: '2026-05-08',
    });

    expect(result.rentals).toHaveLength(1);
    expect(result.rentals[0].provider).toBe('Hertz');
    expect(result.rentals[0].car_name).toBe('Toyota Corolla or similar');
    expect(result.rentals[0].total_price).toBe(315);
  });

  it('returns empty rentals array when API returns no results', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cars_results: [] }),
    });

    const result = await searchCarRentals({
      pickup_location: 'Tokyo',
      pickup_date: '2026-05-01',
      dropoff_date: '2026-05-08',
    });

    expect(result.rentals).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/tools/car-rentals.tool.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement car rentals tool**

Create `server/src/tools/car-rentals.tool.ts`:

```typescript
import { getCache, setCache } from 'app/lib/redis.js';

const SERPAPI_KEY = process.env.SERPAPI_KEY;
const CACHE_TTL = 3600; // 1 hour

interface CarRentalInput {
  pickup_location: string;
  pickup_date: string;
  dropoff_date: string;
  dropoff_location?: string;
  car_type?: string;
}

interface CarRentalResult {
  provider: string;
  provider_logo?: string;
  car_name: string;
  car_type: string;
  price_per_day: number;
  total_price: number;
  currency: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  dropoff_date: string;
  features: string[];
  image_url?: string;
}

export async function searchCarRentals(
  input: CarRentalInput,
): Promise<{ rentals: CarRentalResult[] }> {
  const cacheKey = `car_rentals:${input.pickup_location}:${input.pickup_date}:${input.dropoff_date}:${input.car_type ?? 'any'}`;

  const cached = await getCache(cacheKey);
  if (cached) {
    return cached as { rentals: CarRentalResult[] };
  }

  const params = new URLSearchParams({
    engine: 'google_car_rental',
    api_key: SERPAPI_KEY ?? '',
    pickup_location: input.pickup_location,
    pickup_date: input.pickup_date,
    dropoff_date: input.dropoff_date,
  });

  if (input.dropoff_location) {
    params.set('dropoff_location', input.dropoff_location);
  }

  const response = await fetch(
    `https://serpapi.com/search.json?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(
      `SerpApi car rental search failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  const carsResults = (data.cars_results as Record<string, unknown>[]) ?? [];

  const rentals: CarRentalResult[] = carsResults.slice(0, 5).map((car) => {
    const vehicleInfo = car.vehicle_info as Record<string, string> | undefined;
    const price = car.price as Record<string, number> | undefined;
    const rentalCompany = car.rental_company as Record<string, string> | undefined;
    const features = (car.features as string[]) ?? [];

    return {
      provider: rentalCompany?.name ?? 'Unknown',
      provider_logo: rentalCompany?.logo,
      car_name: vehicleInfo?.name ?? 'Unknown Vehicle',
      car_type: (vehicleInfo?.class ?? 'standard').toLowerCase(),
      price_per_day: price?.per_day ?? 0,
      total_price: price?.total ?? 0,
      currency: (price as Record<string, unknown>)?.currency as string ?? 'USD',
      pickup_location: (car.pickup_location as string) ?? input.pickup_location,
      dropoff_location: (car.dropoff_location as string) ?? input.dropoff_location ?? input.pickup_location,
      pickup_date: input.pickup_date,
      dropoff_date: input.dropoff_date,
      features,
      image_url: car.vehicle_image as string | undefined,
    };
  });

  const result = { rentals };
  await setCache(cacheKey, result, CACHE_TTL);
  return result;
}
```

- [ ] **Step 4: Add search_car_rentals to tool definitions**

In `server/src/tools/definitions.ts`, add to the `toolDefinitions` array:

```typescript
{
  name: 'search_car_rentals',
  description: 'Search for car rental options at a destination. Returns available cars with pricing, features, and pickup/dropoff details.',
  input_schema: {
    type: 'object' as const,
    properties: {
      pickup_location: {
        type: 'string',
        description: 'City or airport for car pickup (e.g. "Tokyo" or "NRT")',
      },
      pickup_date: {
        type: 'string',
        description: 'Pickup date in YYYY-MM-DD format',
      },
      dropoff_date: {
        type: 'string',
        description: 'Dropoff date in YYYY-MM-DD format',
      },
      dropoff_location: {
        type: 'string',
        description: 'City or airport for dropoff. Defaults to pickup location if omitted.',
      },
      car_type: {
        type: 'string',
        description: 'Preferred car type: economy, compact, midsize, suv, luxury, van',
      },
    },
    required: ['pickup_location', 'pickup_date', 'dropoff_date'],
  },
},
```

- [ ] **Step 5: Add format_response to tool definitions**

In `server/src/tools/definitions.ts`, add to the `toolDefinitions` array:

```typescript
{
  name: 'format_response',
  description: 'REQUIRED: Call this as your LAST tool call every turn. Provides your text response, citations, suggested quick replies, and optional advisory escalation. Do NOT write text outside of this tool — all your text goes in the text field.',
  input_schema: {
    type: 'object' as const,
    properties: {
      text: {
        type: 'string',
        description: 'Your markdown-formatted response text to the user.',
      },
      citations: {
        type: 'array',
        description: 'References backing claims in your text. Each citation needs an id (e.g. "1"), label (display text), and either a url (external link) or source_type.',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            url: { type: 'string' },
            source_type: {
              type: 'string',
              enum: ['travel_advisory', 'visa_info', 'weather', 'vaccination', 'general'],
            },
          },
          required: ['id', 'label'],
        },
      },
      quick_replies: {
        type: 'array',
        description: 'Suggested next actions for the user (2-4 short options). Only include when there are clear next steps.',
        items: { type: 'string' },
      },
      advisory: {
        type: 'object',
        description: 'Escalated travel advisory when you detect contextual risk factors (e.g. families traveling to high-risk areas, health concerns). Only use when auto-enrichment baseline is insufficient.',
        properties: {
          severity: {
            type: 'string',
            enum: ['info', 'warning', 'critical'],
          },
          title: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['severity', 'title', 'body'],
      },
    },
    required: ['text'],
  },
},
```

- [ ] **Step 6: Add both tools to executor**

In `server/src/tools/executor.ts`, add imports and cases:

Add import:
```typescript
import { searchCarRentals } from './car-rentals.tool.js';
```

Add cases in the switch:
```typescript
case 'search_car_rentals':
  return await searchCarRentals(input as Parameters<typeof searchCarRentals>[0]);

case 'format_response':
  // format_response is handled by the orchestrator, not executed as a tool
  // Return the input as-is so the orchestrator can extract it
  return input;
```

- [ ] **Step 7: Run tests**

Run: `cd server && npx vitest run src/tools/car-rentals.tool.test.ts`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add server/src/tools/car-rentals.tool.ts server/src/tools/car-rentals.tool.test.ts server/src/tools/definitions.ts server/src/tools/executor.ts
git commit -m "feat: add search_car_rentals and format_response tools"
```

---

## Task 7: Auto-Enrichment Service

**Files:**
- Create: `server/src/services/enrichment.ts`
- Create: `server/src/services/enrichment.test.ts`
- Create: `server/src/services/enrichment-sources/fcdo.ts`
- Create: `server/src/services/enrichment-sources/state-dept.ts`
- Create: `server/src/services/enrichment-sources/open-meteo.ts`
- Create: `server/src/services/enrichment-sources/visa-matrix.ts`
- Create: `server/src/services/enrichment-sources/driving.ts`
- Create: `server/src/data/driving-requirements.json`

- [ ] **Step 1: Create static driving requirements dataset**

Create `server/src/data/driving-requirements.json`:

```json
{
  "US": { "driving_side": "right", "idp_required": false, "min_age": 16 },
  "GB": { "driving_side": "left", "idp_required": false, "min_age": 17 },
  "JP": { "driving_side": "left", "idp_required": true, "min_age": 18, "note": "Japan only accepts IDPs issued under the 1949 Geneva Convention. US and UK IDPs are valid." },
  "AU": { "driving_side": "left", "idp_required": true, "min_age": 18 },
  "TH": { "driving_side": "left", "idp_required": true, "min_age": 18 },
  "IN": { "driving_side": "left", "idp_required": true, "min_age": 18 },
  "DE": { "driving_side": "right", "idp_required": false, "min_age": 18 },
  "FR": { "driving_side": "right", "idp_required": false, "min_age": 18 },
  "IT": { "driving_side": "right", "idp_required": false, "min_age": 18 },
  "ES": { "driving_side": "right", "idp_required": false, "min_age": 18 },
  "MX": { "driving_side": "right", "idp_required": false, "min_age": 18 },
  "BR": { "driving_side": "right", "idp_required": true, "min_age": 18 },
  "ZA": { "driving_side": "left", "idp_required": true, "min_age": 18 },
  "KR": { "driving_side": "right", "idp_required": true, "min_age": 18 },
  "SG": { "driving_side": "left", "idp_required": true, "min_age": 18 },
  "AE": { "driving_side": "right", "idp_required": true, "min_age": 18 },
  "NZ": { "driving_side": "left", "idp_required": true, "min_age": 16 },
  "PT": { "driving_side": "right", "idp_required": false, "min_age": 18 },
  "GR": { "driving_side": "right", "idp_required": true, "min_age": 18 },
  "TR": { "driving_side": "right", "idp_required": false, "min_age": 18 },
  "EG": { "driving_side": "right", "idp_required": true, "min_age": 18 },
  "CR": { "driving_side": "right", "idp_required": false, "min_age": 18 },
  "PE": { "driving_side": "right", "idp_required": true, "min_age": 18 },
  "CO": { "driving_side": "right", "idp_required": true, "min_age": 18 },
  "PG": { "driving_side": "left", "idp_required": true, "min_age": 18, "note": "Driving outside major cities is extremely dangerous. Road conditions are poor and carjacking is common." }
}
```

- [ ] **Step 2: Create enrichment source modules**

Create `server/src/services/enrichment-sources/state-dept.ts`:

```typescript
import { getCache, setCache } from 'app/lib/redis.js';
import type { ChatNode } from '@agentic-travel-agent/shared-types';

const CACHE_TTL = 86400; // 24 hours
const STATE_DEPT_URL =
  'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.json';

interface StateAdvisory {
  country: string;
  iso_code: string;
  advisory_level: number; // 1-4
  advisory_text: string;
  date_updated: string;
}

export async function fetchStateDeptAdvisory(
  countryCode: string,
): Promise<ChatNode | null> {
  const cacheKey = `enrichment:state_dept:${countryCode}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached as ChatNode;

  try {
    const response = await fetch(STATE_DEPT_URL);
    if (!response.ok) return null;

    const data = await response.json();
    const advisories = (data.advisories ?? data) as Record<string, unknown>[];

    const match = advisories.find(
      (a) =>
        (a.iso_code as string)?.toUpperCase() === countryCode.toUpperCase() ||
        (a.country_code as string)?.toUpperCase() === countryCode.toUpperCase(),
    );

    if (!match) return null;

    const level = (match.advisory_level ?? match.level) as number;
    const severity =
      level >= 4 ? 'critical' : level >= 3 ? 'warning' : 'info';
    const levelLabels: Record<number, string> = {
      1: 'Exercise Normal Precautions',
      2: 'Exercise Increased Caution',
      3: 'Reconsider Travel',
      4: 'Do Not Travel',
    };

    const node: ChatNode = {
      type: 'advisory',
      severity,
      title: `US State Dept Advisory: Level ${level} — ${levelLabels[level] ?? 'Unknown'}`,
      body: (match.advisory_text as string) ?? `Travel advisory level ${level} for this destination.`,
    };

    await setCache(cacheKey, node, CACHE_TTL);
    return node;
  } catch {
    return null;
  }
}
```

Create `server/src/services/enrichment-sources/fcdo.ts`:

```typescript
import { getCache, setCache } from 'app/lib/redis.js';
import type { ChatNode } from '@agentic-travel-agent/shared-types';

const CACHE_TTL = 86400; // 24 hours

// Map country codes to GOV.UK slugs
const COUNTRY_SLUGS: Record<string, string> = {
  JP: 'japan',
  TH: 'thailand',
  FR: 'france',
  DE: 'germany',
  IT: 'italy',
  ES: 'spain',
  PT: 'portugal',
  GR: 'greece',
  TR: 'turkey',
  EG: 'egypt',
  ZA: 'south-africa',
  AU: 'australia',
  NZ: 'new-zealand',
  IN: 'india',
  KR: 'south-korea',
  SG: 'singapore',
  AE: 'united-arab-emirates',
  MX: 'mexico',
  BR: 'brazil',
  CR: 'costa-rica',
  PE: 'peru',
  CO: 'colombia',
  PG: 'papua-new-guinea',
  US: 'usa',
  GB: 'uk',
};

interface FCDOSection {
  title: string;
  body: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchFCDOAdvisory(
  countryCode: string,
): Promise<ChatNode[]> {
  const slug = COUNTRY_SLUGS[countryCode.toUpperCase()];
  if (!slug) return [];

  const cacheKey = `enrichment:fcdo:${countryCode}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached as ChatNode[];

  try {
    const url = `https://www.gov.uk/api/content/foreign-travel-advice/${slug}`;
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    const parts = (data.details?.parts ?? []) as Array<{
      title: string;
      body: string;
    }>;

    const nodes: ChatNode[] = [];

    // Extract entry requirements (includes visa info)
    const entryReqs = parts.find(
      (p) => p.title.toLowerCase().includes('entry requirements'),
    );
    if (entryReqs) {
      const body = stripHtml(entryReqs.body);
      if (body.length > 0) {
        nodes.push({
          type: 'advisory',
          severity: 'info',
          title: 'Entry & Visa Requirements',
          body: body.length > 500 ? body.slice(0, 497) + '...' : body,
        });
      }
    }

    // Extract health section (includes vaccination info)
    const health = parts.find(
      (p) => p.title.toLowerCase().includes('health'),
    );
    if (health) {
      const body = stripHtml(health.body);
      if (body.length > 0) {
        nodes.push({
          type: 'advisory',
          severity: 'info',
          title: 'Health & Vaccination Info',
          body: body.length > 500 ? body.slice(0, 497) + '...' : body,
        });
      }
    }

    // Extract safety/security warnings
    const safety = parts.find(
      (p) => p.title.toLowerCase().includes('safety') || p.title.toLowerCase().includes('warnings'),
    );
    if (safety) {
      const body = stripHtml(safety.body);
      if (body.length > 0) {
        const hasDanger =
          body.toLowerCase().includes('do not travel') ||
          body.toLowerCase().includes('advise against');
        nodes.push({
          type: 'advisory',
          severity: hasDanger ? 'warning' : 'info',
          title: 'Safety & Security',
          body: body.length > 500 ? body.slice(0, 497) + '...' : body,
        });
      }
    }

    await setCache(cacheKey, nodes, CACHE_TTL);
    return nodes;
  } catch {
    return [];
  }
}
```

Create `server/src/services/enrichment-sources/open-meteo.ts`:

```typescript
import { getCache, setCache } from 'app/lib/redis.js';
import type { ChatNode, WeatherDay } from '@agentic-travel-agent/shared-types';

const CACHE_TTL = 21600; // 6 hours

const WEATHER_ICONS: Record<number, string> = {
  0: '\u2600\uFE0F',  // Clear sky
  1: '\uD83C\uDF24\uFE0F',  // Mainly clear
  2: '\u26C5',  // Partly cloudy
  3: '\u2601\uFE0F',  // Overcast
  45: '\uD83C\uDF2B\uFE0F', // Fog
  48: '\uD83C\uDF2B\uFE0F', // Depositing rime fog
  51: '\uD83C\uDF26\uFE0F', // Light drizzle
  53: '\uD83C\uDF26\uFE0F', // Moderate drizzle
  55: '\uD83C\uDF27\uFE0F', // Dense drizzle
  61: '\uD83C\uDF27\uFE0F', // Slight rain
  63: '\uD83C\uDF27\uFE0F', // Moderate rain
  65: '\uD83C\uDF27\uFE0F', // Heavy rain
  71: '\uD83C\uDF28\uFE0F', // Slight snow
  73: '\uD83C\uDF28\uFE0F', // Moderate snow
  75: '\uD83C\uDF28\uFE0F', // Heavy snow
  95: '\u26C8\uFE0F',  // Thunderstorm
  96: '\u26C8\uFE0F',  // Thunderstorm with hail
  99: '\u26C8\uFE0F',  // Thunderstorm with heavy hail
};

const WEATHER_LABELS: Record<number, string> = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Foggy',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  95: 'Thunderstorm',
  96: 'Thunderstorm',
  99: 'Severe thunderstorm',
};

export async function fetchWeatherForecast(
  lat: number,
  lon: number,
  departureDate?: string,
): Promise<ChatNode | null> {
  const cacheKey = `enrichment:weather:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached as ChatNode;

  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      daily: 'temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max',
      timezone: 'auto',
      forecast_days: '7',
    });

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
    );
    if (!response.ok) return null;

    const data = await response.json();
    const daily = data.daily as {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      weathercode: number[];
      precipitation_probability_max: number[];
    };

    if (!daily?.time?.length) return null;

    const forecast: WeatherDay[] = daily.time.map((date: string, i: number) => {
      const code = daily.weathercode[i];
      const highC = daily.temperature_2m_max[i];
      const lowC = daily.temperature_2m_min[i];
      return {
        date,
        high_c: Math.round(highC),
        low_c: Math.round(lowC),
        high_f: Math.round(highC * 9 / 5 + 32),
        low_f: Math.round(lowC * 9 / 5 + 32),
        condition: WEATHER_LABELS[code] ?? 'Unknown',
        icon: WEATHER_ICONS[code] ?? '\u2601\uFE0F',
        precipitation_chance: daily.precipitation_probability_max[i] ?? 0,
      };
    });

    const node: ChatNode = { type: 'weather_forecast', forecast };
    await setCache(cacheKey, node, CACHE_TTL);
    return node;
  } catch {
    return null;
  }
}
```

Create `server/src/services/enrichment-sources/driving.ts`:

```typescript
import type { ChatNode } from '@agentic-travel-agent/shared-types';
import drivingData from 'app/data/driving-requirements.json' with { type: 'json' };

interface DrivingRequirement {
  driving_side: string;
  idp_required: boolean;
  min_age: number;
  note?: string;
}

export function getDrivingRequirements(
  countryCode: string,
): ChatNode | null {
  const data = (drivingData as Record<string, DrivingRequirement>)[
    countryCode.toUpperCase()
  ];
  if (!data) return null;

  const parts: string[] = [];
  parts.push(`Drives on the **${data.driving_side}** side of the road.`);

  if (data.idp_required) {
    parts.push('An **International Driving Permit (IDP)** is required to rent and drive a car.');
  } else {
    parts.push('A valid foreign driver\'s license is accepted (no IDP required).');
  }

  parts.push(`Minimum driving age: ${data.min_age}.`);

  if (data.note) {
    parts.push(data.note);
  }

  return {
    type: 'advisory',
    severity: 'info',
    title: 'Driving Requirements',
    body: parts.join(' '),
  };
}
```

Create `server/src/services/enrichment-sources/visa-matrix.ts`:

```typescript
import type { ChatNode } from '@agentic-travel-agent/shared-types';

// Simplified visa requirement lookup
// In production, this would load from the passport-index CSV dataset
const VISA_FREE: Record<string, string[]> = {
  US: ['GB', 'FR', 'DE', 'IT', 'ES', 'PT', 'GR', 'JP', 'KR', 'SG', 'AU', 'NZ', 'MX', 'CR', 'AE', 'TR'],
  GB: ['US', 'FR', 'DE', 'IT', 'ES', 'PT', 'GR', 'JP', 'KR', 'SG', 'AU', 'NZ', 'MX', 'CR', 'AE', 'TR'],
};

const VISA_ON_ARRIVAL: Record<string, string[]> = {
  US: ['TH', 'EG', 'PE'],
  GB: ['TH', 'EG', 'PE'],
};

export function getVisaRequirement(
  originCountry: string,
  destinationCountry: string,
): ChatNode | null {
  const origin = originCountry.toUpperCase();
  const dest = destinationCountry.toUpperCase();

  if (origin === dest) return null;

  const visaFree = VISA_FREE[origin] ?? [];
  const visaOnArrival = VISA_ON_ARRIVAL[origin] ?? [];

  if (visaFree.includes(dest)) {
    return {
      type: 'advisory',
      severity: 'info',
      title: 'Visa Not Required',
      body: `Citizens of ${origin} can enter visa-free for tourism (typically 90 days). Check specific duration limits before travel.`,
    };
  }

  if (visaOnArrival.includes(dest)) {
    return {
      type: 'advisory',
      severity: 'info',
      title: 'Visa on Arrival Available',
      body: `Citizens of ${origin} can obtain a visa on arrival. Fees and duration vary — check current requirements before departure.`,
    };
  }

  return {
    type: 'advisory',
    severity: 'warning',
    title: 'Visa Required',
    body: `Citizens of ${origin} require a visa to enter this country. Apply in advance through the destination country's embassy or consulate.`,
  };
}
```

- [ ] **Step 3: Create the enrichment orchestrator**

Create `server/src/services/enrichment.ts`:

```typescript
import type { ChatNode } from '@agentic-travel-agent/shared-types';
import { fetchStateDeptAdvisory } from './enrichment-sources/state-dept.js';
import { fetchFCDOAdvisory } from './enrichment-sources/fcdo.js';
import { fetchWeatherForecast } from './enrichment-sources/open-meteo.js';
import { getDrivingRequirements } from './enrichment-sources/driving.js';
import { getVisaRequirement } from './enrichment-sources/visa-matrix.js';

// Coordinates for major destinations (subset — expand as needed)
const CITY_COORDS: Record<string, { lat: number; lon: number; country: string }> = {
  'tokyo': { lat: 35.6762, lon: 139.6503, country: 'JP' },
  'paris': { lat: 48.8566, lon: 2.3522, country: 'FR' },
  'london': { lat: 51.5074, lon: -0.1278, country: 'GB' },
  'new york': { lat: 40.7128, lon: -74.006, country: 'US' },
  'barcelona': { lat: 41.3874, lon: 2.1686, country: 'ES' },
  'rome': { lat: 41.9028, lon: 12.4964, country: 'IT' },
  'berlin': { lat: 52.52, lon: 13.405, country: 'DE' },
  'bangkok': { lat: 13.7563, lon: 100.5018, country: 'TH' },
  'sydney': { lat: -33.8688, lon: 151.2093, country: 'AU' },
  'dubai': { lat: 25.2048, lon: 55.2708, country: 'AE' },
  'singapore': { lat: 1.3521, lon: 103.8198, country: 'SG' },
  'seoul': { lat: 37.5665, lon: 126.978, country: 'KR' },
  'lisbon': { lat: 38.7223, lon: -9.1393, country: 'PT' },
  'athens': { lat: 37.9838, lon: 23.7275, country: 'GR' },
  'istanbul': { lat: 41.0082, lon: 28.9784, country: 'TR' },
  'cairo': { lat: 30.0444, lon: 31.2357, country: 'EG' },
  'mexico city': { lat: 19.4326, lon: -99.1332, country: 'MX' },
  'sao paulo': { lat: -23.5505, lon: -46.6333, country: 'BR' },
  'cape town': { lat: -33.9249, lon: 18.4241, country: 'ZA' },
  'auckland': { lat: -36.8485, lon: 174.7633, country: 'NZ' },
  'port moresby': { lat: -6.3149, lon: 147.1803, country: 'PG' },
  'san jose': { lat: 9.9281, lon: -84.0907, country: 'CR' },
  'lima': { lat: -12.0464, lon: -77.0428, country: 'PE' },
  'bogota': { lat: 4.711, lon: -74.0721, country: 'CO' },
  'mumbai': { lat: 19.076, lon: 72.8777, country: 'IN' },
};

function lookupCity(destination: string): { lat: number; lon: number; country: string } | null {
  const key = destination.toLowerCase().trim();
  return CITY_COORDS[key] ?? null;
}

export async function getEnrichmentNodes(
  destination: string,
  originCountry?: string,
): Promise<ChatNode[]> {
  const city = lookupCity(destination);
  if (!city) return [];

  const enrichments = await Promise.allSettled([
    fetchStateDeptAdvisory(city.country),
    fetchFCDOAdvisory(city.country),
    fetchWeatherForecast(city.lat, city.lon),
    Promise.resolve(getDrivingRequirements(city.country)),
    Promise.resolve(
      originCountry
        ? getVisaRequirement(originCountry, city.country)
        : null,
    ),
  ]);

  const nodes: ChatNode[] = [];

  for (const result of enrichments) {
    if (result.status === 'fulfilled' && result.value) {
      if (Array.isArray(result.value)) {
        nodes.push(...result.value);
      } else {
        nodes.push(result.value);
      }
    }
  }

  return nodes;
}
```

- [ ] **Step 4: Write enrichment tests**

Create `server/src/services/enrichment.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { getDrivingRequirements } from './enrichment-sources/driving.js';
import { getVisaRequirement } from './enrichment-sources/visa-matrix.js';

describe('getDrivingRequirements', () => {
  it('returns advisory node for known country', () => {
    const node = getDrivingRequirements('JP');
    expect(node).not.toBeNull();
    expect(node!.type).toBe('advisory');
    if (node!.type === 'advisory') {
      expect(node!.title).toBe('Driving Requirements');
      expect(node!.body).toContain('left');
      expect(node!.body).toContain('International Driving Permit');
    }
  });

  it('returns null for unknown country', () => {
    expect(getDrivingRequirements('XX')).toBeNull();
  });

  it('returns right-side driving without IDP for US', () => {
    const node = getDrivingRequirements('US');
    expect(node).not.toBeNull();
    if (node?.type === 'advisory') {
      expect(node.body).toContain('right');
      expect(node.body).toContain('no IDP required');
    }
  });
});

describe('getVisaRequirement', () => {
  it('returns visa-free for US → Japan', () => {
    const node = getVisaRequirement('US', 'JP');
    expect(node).not.toBeNull();
    if (node?.type === 'advisory') {
      expect(node.title).toBe('Visa Not Required');
      expect(node.severity).toBe('info');
    }
  });

  it('returns visa-on-arrival for US → Thailand', () => {
    const node = getVisaRequirement('US', 'TH');
    expect(node).not.toBeNull();
    if (node?.type === 'advisory') {
      expect(node.title).toBe('Visa on Arrival Available');
    }
  });

  it('returns visa-required for US → unknown', () => {
    const node = getVisaRequirement('US', 'CN');
    expect(node).not.toBeNull();
    if (node?.type === 'advisory') {
      expect(node.title).toBe('Visa Required');
      expect(node.severity).toBe('warning');
    }
  });

  it('returns null for same country', () => {
    expect(getVisaRequirement('US', 'US')).toBeNull();
  });
});
```

- [ ] **Step 5: Run tests**

Run: `cd server && npx vitest run src/services/enrichment.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/services/enrichment.ts server/src/services/enrichment.test.ts server/src/services/enrichment-sources/ server/src/data/driving-requirements.json
git commit -m "feat: add auto-enrichment service with FCDO, State Dept, Open-Meteo, visa matrix, driving data"
```

---

## Task 8: Prompt Consolidation

**Files:**
- Modify: `server/src/prompts/system-prompt.ts`
- Modify: `server/src/prompts/trip-context.ts`

- [ ] **Step 1: Rewrite system prompt**

Replace the entire contents of `server/src/prompts/system-prompt.ts`:

```typescript
import { formatTripContext, type TripContext } from './trip-context.js';

const BASE_PROMPT = `You are a friendly, knowledgeable travel planning assistant. You help users plan trips by searching for flights, car rentals, hotels, and experiences within their budget.

## Planning Workflow

When the user provides trip details (destination, dates, budget):
1. Call \`update_trip\` FIRST to persist the destination, dates, and budget
2. Search flights (largest cost variable)
3. Calculate remaining budget
4. Search car rentals if appropriate for the destination
5. Calculate remaining budget
6. Search hotels with the remaining budget constraint
7. Calculate remaining budget
8. Search experiences with what's left

Always calculate remaining budget between major searches to stay within the user's budget.

## Tools

You have access to search tools for flights, car rentals, hotels, and experiences. You also have:
- \`update_trip\` — call this IMMEDIATELY when the user mentions destination, dates, budget, or number of travelers. Do not wait.
- \`calculate_remaining_budget\` — call this between searches to track spending
- \`get_destination_info\` — call this to get IATA codes and timezone info for a destination
- \`format_response\` — REQUIRED as your LAST tool call every turn (see below)

## format_response (REQUIRED)

You MUST call \`format_response\` as your final tool call on every turn. ALL of your text goes in the \`text\` field — do not write text outside of this tool call.

The \`text\` field supports markdown. Use it naturally for emphasis, lists, and structure.

Optional fields:
- \`citations\` — when referencing travel advisories, visa requirements, or other factual claims, include citation objects with id, label, and url or source_type
- \`quick_replies\` — suggest 2-4 short next actions when there are clear next steps (e.g., "Search for hotels", "Change destination", "Show me luxury options")
- \`advisory\` — escalate a warning when you detect contextual risk factors that the automatic travel advisories may not cover (e.g., families with young children in high-risk areas, specific health concerns, seasonal dangers). Use severity "info" for tips, "warning" for caution, "critical" for serious safety concerns.

## Behavioral Rules

- Maximum 15 tool calls per turn
- Respect user preferences: dietary restrictions, travel intensity, social style
- Be conversational and helpful — suggest alternatives when options are limited
- When the user changes their mind about a selection, search again or help them pick from previous results
- Do not fabricate prices, flight numbers, or hotel names — only present actual search results`;

export function buildSystemPrompt(tripContext?: TripContext): string {
  const parts = [BASE_PROMPT];

  parts.push(`\n\n## Current Date\n\nToday is ${new Date().toISOString().split('T')[0]}.`);

  if (tripContext) {
    parts.push(`\n\n## Current Trip State\n\n${formatTripContext(tripContext)}`);
  }

  return parts.join('');
}
```

- [ ] **Step 2: Update trip context to include car rentals**

Update `server/src/prompts/trip-context.ts` to add car rental tracking. Add to the `TripContext` interface:

```typescript
selected_car_rentals: Array<{
  provider: string;
  car_name: string;
  car_type: string;
  price_per_day: number;
  total_price: number;
}>;
```

And in `formatTripContext()`, add after hotels section:

```typescript
if (ctx.selected_car_rentals.length > 0) {
  lines.push('### Selected Car Rentals');
  for (const car of ctx.selected_car_rentals) {
    lines.push(`- ${car.car_name} from ${car.provider}: $${car.total_price} ($${car.price_per_day}/day)`);
  }
}
```

Ensure `total_spent` includes car rental costs.

- [ ] **Step 3: Commit**

```bash
git add server/src/prompts/system-prompt.ts server/src/prompts/trip-context.ts
git commit -m "feat: consolidate system prompt and add car rental support to trip context"
```

---

## Task 9: Updated Agent Orchestrator — Node Assembly & Typed SSE

**Files:**
- Modify: `server/src/services/AgentOrchestrator.ts`
- Modify: `server/src/services/agent.service.ts`
- Modify: `server/src/handlers/chat/chat.ts`

This is the most complex task — it wires together node building, enrichment, format_response extraction, and the typed SSE protocol.

- [ ] **Step 1: Update AgentOrchestrator to collect nodes and detect format_response**

In `server/src/services/AgentOrchestrator.ts`:

Update the `ProgressEvent` type to use shared types:

```typescript
import type { ChatNode, SSEEvent } from '@agentic-travel-agent/shared-types';
```

Replace the `ProgressEvent` type with `SSEEvent`.

Update the `OrchestratorResult` to include nodes:

```typescript
export interface OrchestratorResult {
  response: string;
  toolCallsUsed: Array<{ name: string; id: string; input: unknown; result: unknown }>;
  tokensUsed: { input: number; output: number };
  iterations: number;
  nodes: ChatNode[];
  formatResponse: {
    text: string;
    citations?: unknown[];
    quick_replies?: string[];
    advisory?: { severity: 'info' | 'warning' | 'critical'; title: string; body: string };
  } | null;
}
```

In the `run()` method, after each tool result:

```typescript
import { buildNodeFromToolResult } from './node-builder.js';

// Inside the tool call loop, after tool execution:
const node = buildNodeFromToolResult(toolBlock.name, toolResult);
if (node) {
  collectedNodes.push(node);
  onEvent?.({ type: 'node', node });
}

// Detect format_response
if (toolBlock.name === 'format_response') {
  formatResponseData = toolResult as OrchestratorResult['formatResponse'];
}
```

Track `collectedNodes: ChatNode[]` and `formatResponseData` as local variables in `run()`.

Include them in the returned `OrchestratorResult`.

- [ ] **Step 2: Update agent.service.ts to assemble final ChatNode array**

In `server/src/services/agent.service.ts`, update `runAgentLoop` to:

1. Accept an `enrichmentNodes` parameter (pre-fetched by the chat handler)
2. Assemble the final `ChatNode[]` array in spec order:
   - Enrichment nodes first
   - Tool result nodes (from orchestrator)
   - Text node (from format_response.text + format_response.citations)
   - Budget bar (if present in collected nodes, move it here)
   - Advisory (from format_response.advisory)
   - Quick replies (from format_response.quick_replies)

```typescript
import type { ChatNode, ChatMessage, Citation } from '@agentic-travel-agent/shared-types';

export interface AgentResult {
  response: string;
  tool_calls: OrchestratorResult['toolCallsUsed'];
  total_tokens: OrchestratorResult['tokensUsed'];
  nodes: ChatNode[];
}

export async function runAgentLoop(
  messages: Anthropic.MessageParam[],
  tripContext: TripContext | undefined,
  onEvent: (event: SSEEvent) => void,
  conversationId?: string | null,
  toolContext?: ToolContext,
  enrichmentNodes?: ChatNode[],
): Promise<AgentResult> {
  // Emit enrichment nodes first
  if (enrichmentNodes) {
    for (const node of enrichmentNodes) {
      onEvent({ type: 'node', node });
    }
  }

  const result = await orchestrator.run(messages, ...);

  // Assemble final node array per spec order
  const finalNodes: ChatNode[] = [];

  // 1. Enrichment nodes
  if (enrichmentNodes) finalNodes.push(...enrichmentNodes);

  // 2. Tool result nodes (excluding budget_bar — reorder below)
  const toolNodes = result.nodes.filter((n) => n.type !== 'budget_bar');
  finalNodes.push(...toolNodes);

  // 3. Text node from format_response
  if (result.formatResponse) {
    finalNodes.push({
      type: 'text',
      content: result.formatResponse.text,
      citations: result.formatResponse.citations as Citation[] | undefined,
    });
  } else if (result.response) {
    // Fallback: if Claude didn't call format_response, wrap raw text
    finalNodes.push({ type: 'text', content: result.response });
  }

  // 4. Budget bar
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
```

- [ ] **Step 3: Update chat handler for typed SSE and dual-column persistence**

In `server/src/handlers/chat/chat.ts`, update the `chat` function:

1. After loading the trip, check if destination changed and fetch enrichment nodes:

```typescript
import { getEnrichmentNodes } from 'app/services/enrichment.js';
import type { ChatNode, ChatMessage, SSEEvent } from '@agentic-travel-agent/shared-types';

// In chat handler, before running agent loop:
let enrichmentNodes: ChatNode[] = [];
// Check if this is the first message or destination is being set
if (trip?.destination) {
  enrichmentNodes = await getEnrichmentNodes(trip.destination, trip.origin ?? undefined);
}
```

2. Persist user message with nodes:

```typescript
const userNodes: ChatNode[] = [{ type: 'text', content: message }];
await insertMessage({
  conversation_id: conversation.id,
  role: 'user',
  content: message,
  nodes: userNodes,
});
```

3. Use typed SSE events:

```typescript
const onEvent = (event: SSEEvent) => {
  res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
};
```

4. Persist assistant message with dual columns:

```typescript
const assistantMessage = await insertMessage({
  conversation_id: conversation.id,
  role: 'assistant',
  content: result.response,
  tool_calls_json: result.tool_calls.length > 0 ? result.tool_calls : undefined,
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
res.write(`event: done\ndata: ${JSON.stringify({ type: 'done', message: chatMessage })}\n\n`);
```

5. Update `getMessages` handler to return `ChatMessage` format:

```typescript
export async function getMessages(req: Request, res: Response) {
  // ... auth and trip loading ...
  const dbMessages = await getMessagesByConversation(conversation.id);

  const messages: ChatMessage[] = dbMessages
    .filter((m) => m.role !== 'tool') // exclude legacy tool-role messages
    .map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      nodes: m.nodes ?? [{ type: 'text' as const, content: m.content ?? '' }],
      sequence: m.sequence,
      created_at: m.created_at,
    }));

  res.json({ messages });
}
```

- [ ] **Step 4: Commit**

```bash
git add server/src/services/AgentOrchestrator.ts server/src/services/agent.service.ts server/src/handlers/chat/chat.ts
git commit -m "feat: wire up node assembly, typed SSE protocol, and dual-column message persistence"
```

---

## Task 10: Frontend — NodeRenderer & MarkdownText

**Files:**
- Create: `web-client/src/components/ChatBox/NodeRenderer.tsx`
- Create: `web-client/src/components/ChatBox/nodes/MarkdownText.tsx`
- Create: `web-client/src/components/ChatBox/nodes/MarkdownText.module.scss`
- Create: `web-client/src/components/ChatBox/nodes/AdvisoryCard.tsx`
- Create: `web-client/src/components/ChatBox/nodes/AdvisoryCard.module.scss`
- Create: `web-client/src/components/ChatBox/nodes/WeatherForecast.tsx`
- Create: `web-client/src/components/ChatBox/nodes/WeatherForecast.module.scss`
- Create: `web-client/src/components/ChatBox/nodes/CarRentalCard.tsx`
- Create: `web-client/src/components/ChatBox/nodes/CarRentalCard.module.scss`
- Create: `web-client/src/components/ChatBox/nodes/CarRentalTiles.tsx`
- Create: `web-client/src/components/ChatBox/nodes/BudgetBar.tsx`
- Create: `web-client/src/components/ChatBox/nodes/ToolProgressIndicator.tsx`

- [ ] **Step 1: Install frontend dependencies**

```bash
cd web-client && pnpm add react-markdown @tanstack/react-virtual
```

- [ ] **Step 2: Create MarkdownText component**

Create `web-client/src/components/ChatBox/nodes/MarkdownText.tsx`:

```tsx
import ReactMarkdown from 'react-markdown';
import type { ChatNodeOfType, Citation } from '@agentic-travel-agent/shared-types';
import styles from './MarkdownText.module.scss';

type Props = ChatNodeOfType<'text'>;

export function MarkdownText({ content, citations }: Props) {
  const citationMap = new Map<string, Citation>();
  if (citations) {
    for (const c of citations) {
      citationMap.set(c.id, c);
    }
  }

  return (
    <div className={styles.markdownText}>
      <ReactMarkdown
        components={{
          a: ({ href, children, ...props }) => {
            // Check if this is a citation reference like [1]
            const text = String(children);
            const citation = citationMap.get(text);
            if (citation?.url) {
              return (
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.citation}
                  title={citation.label}
                  {...props}
                >
                  {children}
                </a>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

Create `web-client/src/components/ChatBox/nodes/MarkdownText.module.scss`:

```scss
.markdownText {
  line-height: 1.6;

  p {
    margin: 0 0 0.5rem;

    &:last-child {
      margin-bottom: 0;
    }
  }

  ul,
  ol {
    margin: 0.25rem 0;
    padding-left: 1.25rem;
  }

  strong {
    font-weight: 600;
  }

  .citation {
    color: var(--accent);
    text-decoration: underline;
    cursor: pointer;
  }

  a {
    color: var(--accent);
    text-decoration: underline;
  }
}
```

- [ ] **Step 3: Create AdvisoryCard component**

Create `web-client/src/components/ChatBox/nodes/AdvisoryCard.tsx`:

```tsx
import type { ChatNodeOfType } from '@agentic-travel-agent/shared-types';
import styles from './AdvisoryCard.module.scss';

type Props = ChatNodeOfType<'advisory'>;

const SEVERITY_ICONS: Record<string, string> = {
  info: '\u2139\uFE0F',
  warning: '\u26A0\uFE0F',
  critical: '\uD83D\uDED1',
};

export function AdvisoryCard({ severity, title, body }: Props) {
  return (
    <div
      className={`${styles.advisory} ${styles[severity]}`}
      role="alert"
      aria-live={severity === 'critical' ? 'assertive' : 'polite'}
    >
      <div className={styles.header}>
        <span className={styles.icon} aria-hidden="true">
          {SEVERITY_ICONS[severity]}
        </span>
        <h4 className={styles.title}>{title}</h4>
      </div>
      <p className={styles.body}>{body}</p>
    </div>
  );
}
```

Create `web-client/src/components/ChatBox/nodes/AdvisoryCard.module.scss`:

```scss
.advisory {
  border-radius: var(--radius-md, 8px);
  padding: 0.75rem 1rem;
  margin: 0.5rem 0;

  &.info {
    background: var(--surface-info, #e8f4fd);
    border-left: 3px solid var(--accent-info, #2196f3);
  }

  &.warning {
    background: var(--surface-warning, #fff8e1);
    border-left: 3px solid var(--accent-warning, #ff9800);
  }

  &.critical {
    background: var(--surface-critical, #fde8e8);
    border-left: 3px solid var(--accent-critical, #f44336);
  }
}

.header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
}

.icon {
  font-size: 1.1rem;
}

.title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
}

.body {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--foreground-muted);
}
```

- [ ] **Step 4: Create WeatherForecast component**

Create `web-client/src/components/ChatBox/nodes/WeatherForecast.tsx`:

```tsx
import type { ChatNodeOfType } from '@agentic-travel-agent/shared-types';
import styles from './WeatherForecast.module.scss';

type Props = ChatNodeOfType<'weather_forecast'>;

export function WeatherForecast({ forecast }: Props) {
  return (
    <div className={styles.weatherForecast} role="region" aria-label="Weather forecast">
      <h4 className={styles.title}>Weather Forecast</h4>
      <div className={styles.days}>
        {forecast.map((day) => (
          <div key={day.date} className={styles.day}>
            <span className={styles.date}>
              {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <span className={styles.icon} aria-hidden="true">
              {day.icon}
            </span>
            <span className={styles.temps}>
              {day.high_f}&deg; / {day.low_f}&deg;
            </span>
            <span className={styles.condition}>{day.condition}</span>
            {day.precipitation_chance > 0 && (
              <span className={styles.rain}>
                {day.precipitation_chance}% rain
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

Create `web-client/src/components/ChatBox/nodes/WeatherForecast.module.scss`:

```scss
.weatherForecast {
  margin: 0.5rem 0;
}

.title {
  margin: 0 0 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.days {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  min-width: 72px;
  padding: 0.5rem;
  background: var(--surface);
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border);
  font-size: 0.75rem;
}

.date {
  font-weight: 600;
  white-space: nowrap;
}

.icon {
  font-size: 1.25rem;
}

.temps {
  font-weight: 500;
}

.condition {
  color: var(--foreground-muted);
  text-align: center;
}

.rain {
  color: var(--accent-info, #2196f3);
  font-size: 0.6875rem;
}
```

- [ ] **Step 5: Create CarRentalCard and CarRentalTiles**

Create `web-client/src/components/ChatBox/nodes/CarRentalCard.tsx`:

```tsx
import type { CarRental } from '@agentic-travel-agent/shared-types';
import { formatCurrency } from '../widgets/FlightCard.js';
import styles from './CarRentalCard.module.scss';

interface CarRentalCardProps {
  rental: CarRental;
  selected: boolean;
  onClick: () => void;
}

export function CarRentalCard({ rental, selected, onClick }: CarRentalCardProps) {
  return (
    <button
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={onClick}
      aria-pressed={selected}
      type="button"
    >
      {rental.image_url && (
        <img
          src={rental.image_url}
          alt={rental.car_name}
          className={styles.image}
        />
      )}
      <div className={styles.details}>
        <div className={styles.provider}>
          {rental.provider_logo && (
            <img
              src={rental.provider_logo}
              alt=""
              className={styles.logo}
            />
          )}
          <span>{rental.provider}</span>
        </div>
        <h4 className={styles.carName}>{rental.car_name}</h4>
        <span className={styles.carType}>{rental.car_type}</span>
        {rental.features.length > 0 && (
          <div className={styles.features}>
            {rental.features.map((f) => (
              <span key={f} className={styles.feature}>
                {f}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className={styles.pricing}>
        <span className={styles.totalPrice}>
          {formatCurrency(rental.total_price, rental.currency)}
        </span>
        <span className={styles.perDay}>
          {formatCurrency(rental.price_per_day, rental.currency)}/day
        </span>
      </div>
    </button>
  );
}
```

Create `web-client/src/components/ChatBox/nodes/CarRentalCard.module.scss`:

```scss
.card {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md, 8px);
  background: var(--surface);
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: border-color 0.15s;

  &:hover {
    border-color: var(--accent);
  }

  &.selected {
    border-color: var(--accent);
    background: var(--surface-accent, rgba(var(--accent-rgb), 0.05));
  }
}

.image {
  width: 80px;
  height: 60px;
  object-fit: contain;
  border-radius: var(--radius-sm, 4px);
}

.details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.provider {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--foreground-muted);
}

.logo {
  height: 16px;
  width: auto;
}

.carName {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
}

.carType {
  font-size: 0.75rem;
  color: var(--foreground-muted);
  text-transform: capitalize;
}

.features {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}

.feature {
  font-size: 0.6875rem;
  padding: 0.125rem 0.375rem;
  background: var(--surface-muted, #f0f0f0);
  border-radius: var(--radius-sm, 4px);
}

.pricing {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 0.125rem;
}

.totalPrice {
  font-weight: 700;
  font-size: 0.9375rem;
}

.perDay {
  font-size: 0.75rem;
  color: var(--foreground-muted);
}
```

Create `web-client/src/components/ChatBox/nodes/CarRentalTiles.tsx`:

```tsx
import { useState } from 'react';
import type { ChatNodeOfType } from '@agentic-travel-agent/shared-types';
import { SelectableCardGroup } from '../widgets/SelectableCardGroup.js';
import { CarRentalCard } from './CarRentalCard.js';

type Props = ChatNodeOfType<'car_rental_tiles'> & {
  onSelect?: (rentalId: string) => void;
  disabled?: boolean;
};

export function CarRentalTiles({ rentals, selectable, onSelect, disabled }: Props) {
  return (
    <SelectableCardGroup
      items={rentals.map((rental) => ({
        id: rental.id,
        label: `${rental.car_name} — ${rental.provider}`,
        node: (selected: boolean, onClick: () => void) => (
          <CarRentalCard
            rental={rental}
            selected={selected}
            onClick={onClick}
          />
        ),
      }))}
      onConfirm={(id) => onSelect?.(id)}
      disabled={disabled || !selectable}
    />
  );
}
```

- [ ] **Step 6: Create BudgetBar and ToolProgressIndicator node components**

Create `web-client/src/components/ChatBox/nodes/BudgetBar.tsx`:

```tsx
import type { ChatNodeOfType } from '@agentic-travel-agent/shared-types';
import { InlineBudgetBar } from '../widgets/InlineBudgetBar.js';

type Props = ChatNodeOfType<'budget_bar'>;

export function BudgetBar({ allocated, total, currency }: Props) {
  return <InlineBudgetBar allocated={allocated} total={total} currency={currency} />;
}
```

Create `web-client/src/components/ChatBox/nodes/ToolProgressIndicator.tsx`:

```tsx
import type { ChatNodeOfType } from '@agentic-travel-agent/shared-types';
import styles from '../../ChatBox/ChatBox.module.scss';

type Props = ChatNodeOfType<'tool_progress'>;

const TOOL_LABELS: Record<string, string> = {
  search_flights: 'Searching flights',
  search_car_rentals: 'Searching car rentals',
  search_hotels: 'Searching hotels',
  search_experiences: 'Finding experiences',
  calculate_remaining_budget: 'Calculating budget',
  update_trip: 'Updating trip details',
  get_destination_info: 'Getting destination info',
  format_response: 'Preparing response',
};

export function ToolProgressIndicator({ tool_name, status }: Props) {
  return (
    <div className={styles.toolRow}>
      <span className={styles.toolIcon}>
        {status === 'running' ? '\u23F3' : '\u2705'}
      </span>
      <span>{TOOL_LABELS[tool_name] ?? tool_name}</span>
    </div>
  );
}
```

- [ ] **Step 7: Create NodeRenderer with component registry**

Create `web-client/src/components/ChatBox/NodeRenderer.tsx`:

```tsx
import type { ChatNode } from '@agentic-travel-agent/shared-types';
import { MarkdownText } from './nodes/MarkdownText.js';
import { AdvisoryCard } from './nodes/AdvisoryCard.js';
import { WeatherForecast } from './nodes/WeatherForecast.js';
import { CarRentalTiles } from './nodes/CarRentalTiles.js';
import { BudgetBar } from './nodes/BudgetBar.js';
import { ToolProgressIndicator } from './nodes/ToolProgressIndicator.js';
import { QuickReplyChips } from './widgets/QuickReplyChips.js';
import { ItineraryTimeline } from './widgets/ItineraryTimeline.js';
import { TripDetailsForm } from './TripDetailsForm.js';
// FlightTiles, HotelTiles, ExperienceTiles reuse existing card+group pattern
import { FlightTiles } from './nodes/FlightTiles.js';
import { HotelTiles } from './nodes/HotelTiles.js';
import { ExperienceTiles } from './nodes/ExperienceTiles.js';

type NodeComponent = React.ComponentType<any>;

const nodeComponents: Record<ChatNode['type'], NodeComponent> = {
  text: MarkdownText,
  flight_tiles: FlightTiles,
  hotel_tiles: HotelTiles,
  car_rental_tiles: CarRentalTiles,
  experience_tiles: ExperienceTiles,
  travel_plan_form: TripDetailsForm,
  itinerary: ItineraryTimeline,
  advisory: AdvisoryCard,
  weather_forecast: WeatherForecast,
  budget_bar: BudgetBar,
  quick_replies: QuickReplyChips,
  tool_progress: ToolProgressIndicator,
};

interface NodeRendererProps {
  node: ChatNode;
  onQuickReply?: (text: string) => void;
  onSelectFlight?: (id: string) => void;
  onSelectHotel?: (id: string) => void;
  onSelectCarRental?: (id: string) => void;
  onSelectExperience?: (id: string) => void;
}

export function NodeRenderer({ node, ...callbacks }: NodeRendererProps) {
  const Component = nodeComponents[node.type];
  if (!Component) return null;

  // Pass relevant callbacks based on node type
  const extraProps: Record<string, unknown> = {};
  if (node.type === 'quick_replies' && callbacks.onQuickReply) {
    extraProps.onSelect = callbacks.onQuickReply;
  }
  if (node.type === 'flight_tiles' && callbacks.onSelectFlight) {
    extraProps.onSelect = callbacks.onSelectFlight;
  }
  if (node.type === 'hotel_tiles' && callbacks.onSelectHotel) {
    extraProps.onSelect = callbacks.onSelectHotel;
  }
  if (node.type === 'car_rental_tiles' && callbacks.onSelectCarRental) {
    extraProps.onSelect = callbacks.onSelectCarRental;
  }
  if (node.type === 'experience_tiles' && callbacks.onSelectExperience) {
    extraProps.onSelect = callbacks.onSelectExperience;
  }

  return <Component {...node} {...extraProps} />;
}
```

Note: `FlightTiles`, `HotelTiles`, and `ExperienceTiles` are thin wrappers around the existing `FlightCard`/`HotelCard`/`ExperienceCard` + `SelectableCardGroup` — create these as simple adapter components following the same pattern as `CarRentalTiles`.

- [ ] **Step 8: Create FlightTiles, HotelTiles, ExperienceTiles adapters**

Create `web-client/src/components/ChatBox/nodes/FlightTiles.tsx`:

```tsx
import type { ChatNodeOfType } from '@agentic-travel-agent/shared-types';
import { SelectableCardGroup } from '../widgets/SelectableCardGroup.js';
import { FlightCard } from '../widgets/FlightCard.js';

type Props = ChatNodeOfType<'flight_tiles'> & {
  onSelect?: (flightId: string) => void;
  disabled?: boolean;
};

export function FlightTiles({ flights, selectable, onSelect, disabled }: Props) {
  return (
    <SelectableCardGroup
      items={flights.map((flight) => ({
        id: flight.id,
        label: `${flight.airline} ${flight.flight_number}`,
        node: (selected: boolean, onClick: () => void) => (
          <FlightCard
            airline={flight.airline}
            airlineLogo={flight.airline_logo}
            flightNumber={flight.flight_number}
            origin={flight.origin}
            destination={flight.destination}
            departureTime={flight.departure_time}
            price={flight.price}
            currency={flight.currency}
            selected={selected}
            onClick={onClick}
          />
        ),
      }))}
      onConfirm={(id) => onSelect?.(id)}
      disabled={disabled || !selectable}
    />
  );
}
```

Create `web-client/src/components/ChatBox/nodes/HotelTiles.tsx`:

```tsx
import type { ChatNodeOfType } from '@agentic-travel-agent/shared-types';
import { SelectableCardGroup } from '../widgets/SelectableCardGroup.js';
import { HotelCard } from '../widgets/HotelCard.js';

type Props = ChatNodeOfType<'hotel_tiles'> & {
  onSelect?: (hotelId: string) => void;
  disabled?: boolean;
};

export function HotelTiles({ hotels, selectable, onSelect, disabled }: Props) {
  return (
    <SelectableCardGroup
      items={hotels.map((hotel) => ({
        id: hotel.id,
        label: hotel.name,
        node: (selected: boolean, onClick: () => void) => (
          <HotelCard
            name={hotel.name}
            city={hotel.city}
            imageUrl={hotel.image_url}
            starRating={hotel.star_rating}
            pricePerNight={hotel.price_per_night}
            totalPrice={hotel.total_price}
            currency={hotel.currency}
            checkIn={hotel.check_in}
            checkOut={hotel.check_out}
            lat={hotel.lat}
            lon={hotel.lon}
            selected={selected}
            onClick={onClick}
          />
        ),
      }))}
      onConfirm={(id) => onSelect?.(id)}
      disabled={disabled || !selectable}
    />
  );
}
```

Create `web-client/src/components/ChatBox/nodes/ExperienceTiles.tsx`:

```tsx
import type { ChatNodeOfType } from '@agentic-travel-agent/shared-types';
import { SelectableCardGroup } from '../widgets/SelectableCardGroup.js';
import { ExperienceCard } from '../widgets/ExperienceCard.js';

type Props = ChatNodeOfType<'experience_tiles'> & {
  onSelect?: (experienceId: string) => void;
  disabled?: boolean;
};

export function ExperienceTiles({ experiences, selectable, onSelect, disabled }: Props) {
  return (
    <SelectableCardGroup
      items={experiences.map((exp) => ({
        id: exp.id,
        label: exp.name,
        node: (selected: boolean, onClick: () => void) => (
          <ExperienceCard
            name={exp.name}
            category={exp.category}
            photoRef={exp.photo_ref}
            rating={exp.rating}
            estimatedCost={exp.estimated_cost}
            lat={exp.lat}
            lon={exp.lon}
            selected={selected}
            onClick={onClick}
          />
        ),
      }))}
      onConfirm={(id) => onSelect?.(id)}
      disabled={disabled || !selectable}
    />
  );
}
```

- [ ] **Step 9: Commit**

```bash
git add web-client/src/components/ChatBox/NodeRenderer.tsx web-client/src/components/ChatBox/nodes/
git commit -m "feat: add NodeRenderer component registry with all node type components"
```

---

## Task 11: Frontend — useSSEChat Hook & VirtualizedChat

**Files:**
- Create: `web-client/src/components/ChatBox/useSSEChat.ts`
- Create: `web-client/src/components/ChatBox/VirtualizedChat.tsx`
- Create: `web-client/src/components/ChatBox/VirtualizedChat.module.scss`

- [ ] **Step 1: Create useSSEChat hook**

Create `web-client/src/components/ChatBox/useSSEChat.ts`:

```typescript
import { useState, useCallback, useRef } from 'react';
import type { ChatNode, ChatMessage, SSEEvent } from '@agentic-travel-agent/shared-types';
import { useQueryClient } from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface UseSSEChatOptions {
  tripId: string;
}

interface UseSSEChatReturn {
  sendMessage: (message: string) => Promise<void>;
  isSending: boolean;
  streamingNodes: ChatNode[];
  toolProgress: ChatNode[];
  streamingText: string;
}

export function useSSEChat({ tripId }: UseSSEChatOptions): UseSSEChatReturn {
  const [isSending, setIsSending] = useState(false);
  const [streamingNodes, setStreamingNodes] = useState<ChatNode[]>([]);
  const [toolProgress, setToolProgress] = useState<ChatNode[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const queryClient = useQueryClient();

  const sendMessage = useCallback(
    async (message: string) => {
      setIsSending(true);
      setStreamingNodes([]);
      setToolProgress([]);
      setStreamingText('');

      try {
        const res = await fetch(`${API_BASE}/trips/${tripId}/chat`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ message }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`Chat request failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          let eventType = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7);
            } else if (line.startsWith('data: ')) {
              const event = JSON.parse(line.slice(6)) as SSEEvent;
              handleEvent(event);
            }
          }
        }
      } catch (err) {
        console.error('SSE chat error:', err);
      } finally {
        setIsSending(false);
        setToolProgress([]);
        queryClient.invalidateQueries({ queryKey: ['messages', tripId] });
        queryClient.invalidateQueries({ queryKey: ['trips', tripId] });
      }
    },
    [tripId, queryClient],
  );

  function handleEvent(event: SSEEvent) {
    switch (event.type) {
      case 'node':
        setStreamingNodes((prev) => [...prev, event.node]);
        break;

      case 'text_delta':
        setStreamingText((prev) => prev + event.content);
        break;

      case 'tool_progress':
        setToolProgress((prev) => {
          const existing = prev.findIndex(
            (n) =>
              n.type === 'tool_progress' &&
              n.tool_id === event.tool_id,
          );
          const node: ChatNode = {
            type: 'tool_progress',
            tool_name: event.tool_name ?? '',
            tool_id: event.tool_id,
            status: event.status,
          };
          if (existing >= 0) {
            const next = [...prev];
            next[existing] = node;
            return next;
          }
          return [...prev, node];
        });
        break;

      case 'done':
        // Replace streaming state with canonical message
        setStreamingNodes([]);
        setStreamingText('');
        break;

      case 'error':
        setStreamingText(event.error);
        break;
    }
  }

  return {
    sendMessage,
    isSending,
    streamingNodes,
    toolProgress,
    streamingText,
  };
}
```

- [ ] **Step 2: Create VirtualizedChat component**

Create `web-client/src/components/ChatBox/VirtualizedChat.tsx`:

```tsx
import { useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ChatMessage, ChatNode } from '@agentic-travel-agent/shared-types';
import { NodeRenderer } from './NodeRenderer.js';
import styles from './VirtualizedChat.module.scss';

interface VirtualizedChatProps {
  messages: ChatMessage[];
  streamingNodes: ChatNode[];
  toolProgress: ChatNode[];
  streamingText: string;
  isSending: boolean;
  onQuickReply: (text: string) => void;
}

// Height estimates by node type for initial sizing
const NODE_HEIGHT_ESTIMATES: Partial<Record<ChatNode['type'], number>> = {
  text: 60,
  flight_tiles: 240,
  hotel_tiles: 240,
  car_rental_tiles: 240,
  experience_tiles: 200,
  travel_plan_form: 300,
  itinerary: 200,
  advisory: 80,
  weather_forecast: 120,
  budget_bar: 48,
  quick_replies: 48,
  tool_progress: 32,
};

function estimateMessageHeight(nodes: ChatNode[]): number {
  if (nodes.length === 0) return 40;
  return nodes.reduce(
    (sum, node) => sum + (NODE_HEIGHT_ESTIMATES[node.type] ?? 60),
    16, // padding
  );
}

export function VirtualizedChat({
  messages,
  streamingNodes,
  toolProgress,
  streamingText,
  isSending,
  onQuickReply,
}: VirtualizedChatProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  // Build the streaming message if active
  const streamingMessage: ChatMessage | null =
    isSending && (streamingNodes.length > 0 || toolProgress.length > 0 || streamingText)
      ? {
          id: '__streaming__',
          role: 'assistant',
          nodes: [
            ...toolProgress,
            ...streamingNodes,
            ...(streamingText
              ? [{ type: 'text' as const, content: streamingText }]
              : []),
          ],
          sequence: messages.length + 1,
          created_at: new Date().toISOString(),
        }
      : null;

  const allMessages = streamingMessage
    ? [...messages, streamingMessage]
    : messages;

  const virtualizer = useVirtualizer({
    count: allMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => estimateMessageHeight(allMessages[index].nodes),
    overscan: 3,
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (wasAtBottomRef.current && allMessages.length > 0) {
      virtualizer.scrollToIndex(allMessages.length - 1, { align: 'end' });
    }
  }, [allMessages.length, streamingText]);

  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    wasAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  }, []);

  return (
    <div
      ref={parentRef}
      className={styles.chatContainer}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const message = allMessages[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              className={`${styles.message} ${styles[message.role]}`}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {message.nodes.map((node, nodeIdx) => (
                <NodeRenderer
                  key={`${message.id}-${nodeIdx}`}
                  node={node}
                  onQuickReply={onQuickReply}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

Create `web-client/src/components/ChatBox/VirtualizedChat.module.scss`:

```scss
.chatContainer {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.message {
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
  border-radius: var(--radius-xl, 12px);
  max-width: 85%;

  &.user {
    margin-left: auto;
    background: var(--accent);
    color: white;
  }

  &.assistant {
    margin-right: auto;
    background: var(--surface);
    border: 1px solid var(--border);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add web-client/src/components/ChatBox/useSSEChat.ts web-client/src/components/ChatBox/VirtualizedChat.tsx web-client/src/components/ChatBox/VirtualizedChat.module.scss
git commit -m "feat: add useSSEChat hook and VirtualizedChat with TanStack Virtual"
```

---

## Task 12: Frontend — Integrate Into ChatBox & Remove Regex Parsers

**Files:**
- Modify: `web-client/src/components/ChatBox/ChatBox.tsx`
- Modify: `web-client/src/components/ChatBox/TripDetailsForm.tsx` (remove parseTripFormFields, parseSubmittedValues)
- Modify: `web-client/src/components/ChatBox/widgets/ItineraryTimeline.tsx` (remove parseItinerary)
- Modify: `web-client/src/components/ChatBox/widgets/QuickReplyChips.tsx` (remove parseQuickReplies)

- [ ] **Step 1: Refactor ChatBox to use VirtualizedChat and useSSEChat**

Gut the existing ChatBox component. Remove:
- All inline SSE parsing logic
- All regex-based conditional rendering
- The `renderText()` function
- Direct tool result state management
- Direct `fetch` call for SSE

Replace with:
- `useSSEChat` hook for SSE handling
- `VirtualizedChat` for message rendering
- TanStack Query for persisted messages (already exists)

The ChatBox becomes a thin shell:

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ChatMessage } from '@agentic-travel-agent/shared-types';
import { get } from '@/lib/api';
import { useSSEChat } from './useSSEChat.js';
import { VirtualizedChat } from './VirtualizedChat.js';
import styles from './ChatBox.module.scss';

interface ChatBoxProps {
  tripId: string;
  // ... existing props for trip status, booking actions
}

export function ChatBox({ tripId, ...props }: ChatBoxProps) {
  const [input, setInput] = useState('');

  const { data: serverMessages } = useQuery({
    queryKey: ['messages', tripId],
    queryFn: () => get<{ messages: ChatMessage[] }>(`/trips/${tripId}/messages`).then((r) => r.messages),
  });

  const {
    sendMessage,
    isSending,
    streamingNodes,
    toolProgress,
    streamingText,
  } = useSSEChat({ tripId });

  async function handleSend() {
    const msg = input.trim();
    if (!msg || isSending) return;
    setInput('');

    // Optimistic user message
    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      nodes: [{ type: 'text', content: msg }],
      sequence: (serverMessages?.length ?? 0) + 1,
      created_at: new Date().toISOString(),
    };

    await sendMessage(msg);
  }

  function handleQuickReply(text: string) {
    setInput(text);
    handleSend();
  }

  return (
    <div className={styles.chatBox}>
      <VirtualizedChat
        messages={serverMessages ?? []}
        streamingNodes={streamingNodes}
        toolProgress={toolProgress}
        streamingText={streamingText}
        isSending={isSending}
        onQuickReply={handleQuickReply}
      />
      <form className={styles.inputArea} onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Plan your trip..."
          disabled={isSending}
          className={styles.input}
        />
        <button type="submit" disabled={isSending || !input.trim()} className={styles.sendButton}>
          Send
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Remove regex parser exports from widget files**

In `web-client/src/components/ChatBox/TripDetailsForm.tsx`:
- Remove the `parseTripFormFields()` function and its export
- Remove the `parseSubmittedValues()` function and its export
- Keep the `TripDetailsForm` component itself — it becomes the renderer for `travel_plan_form` nodes
- Update its props to accept `FormField[]` from the node type instead of deriving fields from regex

In `web-client/src/components/ChatBox/widgets/ItineraryTimeline.tsx`:
- Remove the `parseItinerary()` function and its export
- Keep the `ItineraryTimeline` component — it renders `itinerary` nodes
- Update props to accept `DayPlan[]` directly

In `web-client/src/components/ChatBox/widgets/QuickReplyChips.tsx`:
- Remove the `parseQuickReplies()` function and its export
- Keep the `QuickReplyChips` component — it renders `quick_replies` nodes
- Update props to accept `options: string[]` and `onSelect: (text: string) => void`

- [ ] **Step 3: Commit**

```bash
git add web-client/src/components/ChatBox/
git commit -m "feat: integrate VirtualizedChat into ChatBox, remove all regex parsers"
```

---

## Task 13: Verification — Build & Type Check

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript type check on shared-types**

Run: `cd packages/shared-types && pnpm typecheck`
Expected: No errors

- [ ] **Step 2: Run TypeScript type check on server**

Run: `cd server && npx tsc --noEmit`
Expected: No errors (may need to fix import paths for shared-types)

- [ ] **Step 3: Run TypeScript type check on web-client**

Run: `cd web-client && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run server unit tests**

Run: `cd server && pnpm test`
Expected: All tests PASS (existing + new node-builder + enrichment tests)

- [ ] **Step 5: Run full build**

Run: `pnpm build`
Expected: Both server and web-client build successfully

- [ ] **Step 6: Fix any issues found and commit**

```bash
git add -A
git commit -m "fix: resolve type errors and build issues from typed chat protocol migration"
```

---

## Task 14: Smoke Test — End-to-End Chat Flow

- [ ] **Step 1: Start dev servers**

Run: `pnpm dev`
Expected: Both server and web-client start

- [ ] **Step 2: Manual verification**

1. Open the app and start a new trip
2. Send a message like "Plan a trip to Tokyo for 7 days with a $5000 budget"
3. Verify:
   - Tool progress indicators appear during searches
   - Advisory cards appear (visa info, driving requirements, weather)
   - Flight tiles render with selectable cards
   - Car rental tiles appear
   - Hotel tiles appear
   - Budget bar updates
   - Text is rendered as markdown
   - Quick reply buttons appear
4. Select a flight, car, hotel — verify selections update trip state
5. Scroll up — verify old messages render correctly
6. Change selection on an older message — verify trip state updates

- [ ] **Step 3: Run smoke test script**

Run: `pnpm smoke-test`
Expected: All health checks pass

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "fix: final adjustments from end-to-end smoke test"
```
