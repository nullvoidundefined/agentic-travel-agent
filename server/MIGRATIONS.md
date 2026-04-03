# Database Schema — Chat Data Structure

## Messages Table

The messages table uses a **dual-column pattern** separating display state from conversation state.

### Columns

| Column            | Type                     | Purpose                                        | Consumer                                        |
| ----------------- | ------------------------ | ---------------------------------------------- | ----------------------------------------------- |
| `id`              | UUID                     | Primary key                                    | Both                                            |
| `conversation_id` | UUID                     | FK to conversations                            | Both                                            |
| `role`            | ENUM('user','assistant') | Message author                                 | Both                                            |
| `content`         | TEXT                     | Claude's raw text response                     | Agent service (API conversation reconstruction) |
| `tool_calls_json` | JSONB                    | Raw tool_use/tool_result blocks                | Agent service (API conversation reconstruction) |
| `nodes`           | JSONB                    | Ordered `ChatNode[]` for UI rendering          | Frontend                                        |
| `schema_version`  | INTEGER                  | Shape version for forward-compatible rendering | Frontend                                        |
| `sequence`        | INTEGER                  | Strict ordering within conversation            | Both                                            |
| `token_count`     | INTEGER                  | Input + output tokens consumed                 | Observability                                   |
| `created_at`      | TIMESTAMPTZ              | Insertion timestamp                            | Both                                            |

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

| Type               | Description                              | Selectable |
| ------------------ | ---------------------------------------- | ---------- |
| `text`             | Markdown content with optional citations | No         |
| `flight_tiles`     | Flight search results                    | Yes        |
| `hotel_tiles`      | Hotel search results                     | Yes        |
| `car_rental_tiles` | Car rental search results                | Yes        |
| `experience_tiles` | Experience/activity search results       | Yes        |
| `travel_plan_form` | Structured form for trip details         | No         |
| `itinerary`        | Day-by-day plan                          | No         |
| `advisory`         | Travel advisories, visa/vaccination info | No         |
| `weather_forecast` | Multi-day weather outlook                | No         |
| `budget_bar`       | Budget allocation tracker                | No         |
| `quick_replies`    | Suggested response buttons               | No         |
| `tool_progress`    | Tool execution status indicator          | No         |

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
