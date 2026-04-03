<!-- vibelens format:1 -->

# Technical Summary

## Architecture at a Glance

Voyager is a fullstack monorepo with a Next.js 15 frontend and an Express 5 + TypeScript API. The core feature is an **agentic tool-use loop** where Claude calls external travel APIs iteratively, reasoning between calls to build budget-aware itineraries. A `packages/shared-types` workspace package defines the typed chat protocol shared between server and frontend.

```
Browser (Next.js)  -->  Express API  -->  Anthropic Claude
                            |                    |
                            |              Tool calls (3-8 per turn)
                            |                    |
                        PostgreSQL         SerpApi / Google Places
                            |                    |
                          Redis (cache)    Auto-enrichment (State Dept,
                                          FCDO, Open-Meteo, visa matrix)
```

## Core Concepts

### The Agent Loop

The `AgentOrchestrator` class (`server/src/services/AgentOrchestrator.ts`) implements a while-loop that:

1. Sends conversation messages + tool definitions to Claude
2. If Claude returns `stop_reason: "end_turn"` -- return the text response
3. If Claude returns `stop_reason: "tool_use"` -- execute each tool, append results as `tool_result` messages, and loop back to step 1
4. Safety limit: 15 tool calls per turn maximum

The orchestrator emits `ProgressEvent`s (`tool_start`, `tool_result`, `assistant`) that the chat handler streams to the frontend via SSE.

### Tools

Eight tools are registered with Claude via `TOOL_DEFINITIONS` in `server/src/tools/definitions.ts`:

| Tool                         | Implementation                   | External API                       |
| ---------------------------- | -------------------------------- | ---------------------------------- |
| `search_flights`             | `flights.tool.ts`                | SerpApi `google_flights` engine    |
| `search_hotels`              | `hotels.tool.ts`                 | SerpApi `google_hotels` engine     |
| `search_car_rentals`         | `car-rentals.tool.ts`            | SerpApi `google_car_rental` engine |
| `search_experiences`         | `experiences.tool.ts`            | Google Places Text Search          |
| `calculate_remaining_budget` | `budget.tool.ts`                 | Local computation (no API)         |
| `get_destination_info`       | `destination.tool.ts`            | Local lookup table (24 cities)     |
| `update_trip`                | `executor.ts` -> `trips.ts` repo | PostgreSQL update                  |
| `format_response`            | Handled in chat handler          | None (agent text + citations)      |

### Typed Chat Protocol

All messages are stored and streamed as ordered arrays of `ChatNode` objects, defined in `packages/shared-types/src/nodes.ts`. The `ChatNode` type is a TypeScript discriminated union with 12 variants: `text`, `flight_tiles`, `hotel_tiles`, `car_rental_tiles`, `experience_tiles`, `travel_plan_form`, `itinerary`, `advisory`, `weather_forecast`, `budget_bar`, `quick_replies`, and `tool_progress`.

This is a **server-driven UI** protocol: the server decides what nodes to render; the frontend maps each node type to a React component via the `NodeRenderer` registry. TypeScript enforces exhaustiveness -- if a new node type is added to shared-types but no component is registered, the frontend will not compile.

### Auto-Enrichment Service

`server/src/services/enrichment.ts` runs automatically whenever a destination is resolved. It fans out to five sources in parallel:

- **US State Dept advisory** -- fetches current travel advisory level
- **UK FCDO advisory** -- fetches Foreign Commonwealth & Development Office advisory
- **Open-Meteo** -- 7-day weather forecast using the destination's coordinates
- **Visa matrix** -- static lookup table for visa requirements by origin/destination country pair
- **Driving requirements** -- static table of left/right-hand traffic, license requirements per country

Results arrive as `advisory` and `weather_forecast` ChatNodes appended to the message stream. The agent did not have to call any tools to produce this -- enrichment is orchestrated by the server, not by Claude.

### Node Builder Layer

`server/src/services/node-builder.ts` sits between tool execution and message persistence. After each tool result, the node builder converts the raw JSON result into the appropriate `ChatNode` (e.g., `search_flights` result -> `flight_tiles` node, `calculate_remaining_budget` result -> `budget_bar` node). This keeps the serialization logic in one place and ensures the agent's raw tool output never reaches the frontend directly.

### Data Flow for a Chat Turn

1. Frontend sends `POST /trips/:id/chat` with `{ message }` and `X-Requested-With` header
2. Chat handler loads trip, user preferences, and conversation history from PostgreSQL
3. Builds `TripContext` with selected flights/hotels/car rentals/experiences and budget state
4. Calls `runAgentLoop()` which delegates to `AgentOrchestrator.run()`
5. Tool results are converted to ChatNodes by the node builder and streamed via SSE
6. Auto-enrichment nodes are appended when a destination is resolved
7. User and assistant messages are persisted to `messages` table with both `nodes` (frontend) and `content`/`tool_calls_json` (agent conversation) columns
8. Frontend `useSSEChat` hook reads the typed SSE stream and updates UI in real time

### Authentication

Custom session-based auth (no Supabase for this app):

- `POST /auth/register` -- bcrypt hash (12 rounds), create user + session in a transaction
- `POST /auth/login` -- verify password, delete old sessions, create new session in a transaction
- Sessions stored as SHA-256 hashes in `sessions` table; raw token in httpOnly cookie
- `loadSession` middleware reads cookie on every request; `requireAuth` blocks unauthenticated access

### Caching Strategy

Redis caches SerpApi and Google Places responses with a 1-hour TTL:

- Cache keys are deterministic: `api_cache:{provider}:{endpoint}:{sorted_params_json}`
- `normalizeCacheKey()` lowercases and sorts params for consistent cache hits
- Critical for staying within SerpApi's 250 searches/month free tier

### Database Schema

13 migration files create these tables: `users`, `sessions`, `trips`, `trip_flights`, `trip_hotels`, `trip_experiences`, `trip_car_rentals`, `conversations`, `messages`, `api_cache`, `tool_call_log`, `user_preferences`

The `messages` table uses a **dual-column pattern**: `nodes` (JSONB `ChatNode[]`) stores the display state the frontend renders; `content` + `tool_calls_json` store the raw Claude API conversation state the agent needs to reconstruct context. These evolve independently. A `schema_version` INTEGER column enables forward-compatible rendering as the node schema evolves. A `sequence` INTEGER column (unique per conversation) provides strict message ordering.

### Frontend State Management

- **TanStack Query** for all server state (trips, messages, user preferences, auth)
- **`useSSEChat`** custom hook manages the SSE stream, typed node accumulation, and tool progress state
- **`VirtualizedChat`** component renders the message list with `@tanstack/react-virtual` for performance
- **`NodeRenderer`** component registry maps each `ChatNode` type to its React component
- `AuthContext` wraps the app with `useQuery` for `/auth/me` and provides `login`, `signup`, `logout`
- No client-side store (no Redux, no Zustand) -- all state is server-derived or component-local

### CSRF Protection

Header-only CSRF: all mutating requests must include `X-Requested-With: XMLHttpRequest`. The `csrfGuard` middleware rejects state-changing requests without this header.

## Deployment

- **Frontend**: `cd web-client && npx vercel --prod` -- deploys to Vercel
- **Backend**: `railway up --detach` from monorepo root -- builds `Dockerfile.server`, runs `node server/dist/index.js`
- Multi-stage Docker build: Node 22-slim base, pnpm workspace install, TypeScript compile, production-only deps in final image
