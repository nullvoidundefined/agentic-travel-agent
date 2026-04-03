<!-- vibelens format:1 -->

# Technical Overview

## System Architecture

Voyager follows a standard client-server architecture with a conversational AI agent at its core. The frontend is a Next.js 15 App Router application deployed to Vercel. The backend is an Express 5 API deployed to Railway via Docker. PostgreSQL on Neon provides persistence, and Redis on Railway provides caching for external API responses. A `packages/shared-types` workspace package publishes the `ChatNode` discriminated union and supporting interfaces, which are imported by both the server and the frontend.

```
                    +-------------------+
                    |   Next.js 15      |
                    |   (Vercel)        |
                    |                   |
                    |  App Router       |
                    |  TanStack Query   |
                    |  TanStack Virtual |
                    |  AuthContext      |
                    |  useSSEChat hook  |
                    |  NodeRenderer     |
                    +--------+----------+
                             |
                    HTTPS (credentials: include)
                    X-Requested-With: XMLHttpRequest
                             |
                    +--------v----------+
                    |   Express 5 API   |
                    |   (Railway)       |
                    |                   |
                    |  Auth middleware   |
                    |  Chat handler     |
                    |  AgentOrchestrator|
                    |  Node Builder     |
                    |  Enrichment Svc   |
                    +--+------+------+--+
                       |      |      |
            +----------+  +---+---+  +----------+
            |             |       |             |
      +-----v-----+ +----v----+ +v---------+ +-v--------+
      | PostgreSQL | | Redis   | | SerpApi  | | Google   |
      | (Neon)     | | (Rly)   | | Flights/ | | Places   |
      |            | | 1hr TTL | | Hotels/  | | API      |
      +------------+ +---------+ | Cars     | +----------+
                                 +----------+
                                       |
                               +-------v-------+
                               | State Dept    |
                               | FCDO          |
                               | Open-Meteo    |
                               | Visa Matrix   |
                               +---------------+
```

## Monorepo Packages

```
/
  packages/
    shared-types/       -- ChatNode union, Flight, Hotel, CarRental, Experience, SSEEvent
  server/               -- Express 5 API
  web-client/           -- Next.js 15 frontend
```

`packages/shared-types` is a TypeScript-only package (`@agentic-travel-agent/shared-types`) imported by both `server/` and `web-client/`. It is the single source of truth for the typed chat protocol. Changes to `ChatNode` are immediately reflected in both packages, and TypeScript enforces that every node type has a corresponding component in the frontend's `NodeRenderer`.

## Backend Architecture

### Layered Structure

The server follows a strict layered architecture:

```
Routes  -->  Handlers  -->  Services  -->  Repositories  -->  Database
                               |
                  Node Builder + Enrichment
                               |
                            Tools  -->  External APIs
```

- **Routes** (`server/src/routes/`): Define Express routers, attach middleware like `requireAuth`. Files: `auth.ts`, `trips.ts`, `places.ts`, `userPreferences.ts`.
- **Handlers** (`server/src/handlers/`): Parse/validate requests, call services or repos, format responses. The `chat` handler (`handlers/chat/chat.ts`) is the most complex -- it loads trip context, sets up SSE, runs the agent loop, appends enrichment nodes, and persists messages.
- **Services** (`server/src/services/`): Business logic. `AgentOrchestrator.ts` is the core service. `node-builder.ts` maps tool results to ChatNodes. `enrichment.ts` orchestrates auto-enrichment. `serpapi.service.ts` wraps fetch calls to SerpApi. `cache.service.ts` wraps Redis get/set/del.
- **Repositories** (`server/src/repositories/`): Raw SQL queries via `pg`. No ORM. Files: `auth/auth.ts`, `trips/trips.ts`, `conversations/conversations.ts`, `tool-call-log/tool-call-log.ts`, `userPreferences/userPreferences.ts`.
- **Tools** (`server/src/tools/`): Each tool file exports a function that the executor dispatches to. `definitions.ts` exports the Anthropic tool schemas. `executor.ts` maps tool names to implementation functions.

### AgentOrchestrator

`server/src/services/AgentOrchestrator.ts` is the heart of the application. It is a class that accepts:

- `tools`: Anthropic tool definitions (JSON schemas)
- `systemPromptBuilder`: A function that builds the system prompt from context arguments
- `toolExecutor`: A function that executes a named tool with input
- `onToolExecuted`: Optional callback for logging/observability
- `maxIterations`: Safety limit (default 15)
- `model`: Claude model (default `claude-sonnet-4-20250514`)

The `run()` method implements the agentic loop:

```
while (true) {
    response = await claude.messages.create(messages, tools)
    if end_turn: return response text
    if tool_use: execute tools, append results, continue loop
    if over limit: return safety message
}
```

Progress events (`tool_start`, `tool_result`, `assistant`) are emitted via callback for real-time SSE streaming.

### Tool Implementations

**search_flights** (`server/src/tools/flights.tool.ts`):

- Calls SerpApi `google_flights` engine with IATA codes, dates, passengers
- Normalizes `SerpApiFlight` responses into `FlightResult` objects
- Filters by `max_price`, sorts by price, returns top 5
- Caches results in Redis for 1 hour

**search_hotels** (`server/src/tools/hotels.tool.ts`):

- Calls SerpApi `google_hotels` engine with city name, dates, guests
- Normalizes `SerpApiHotel` responses into `HotelResult` objects
- Filters by star rating and max price per night
- Caches results in Redis for 1 hour

**search_car_rentals** (`server/src/tools/car-rentals.tool.ts`):

- Calls SerpApi `google_car_rental` engine with pickup location, dates, optional car type
- Normalizes `SerpApiCarResult` responses into `CarRentalResult` objects (provider, car name, type, price per day, total, features)
- Returns top 5 results; caches in Redis for 1 hour

**search_experiences** (`server/src/tools/experiences.tool.ts`):

- Calls Google Places Text Search API with location + category keywords
- Uses field mask for efficient responses: id, displayName, address, rating, priceLevel, photos, location
- Maps `priceLevel` enums to estimated USD costs ($0-$150 range)
- Caches results in Redis for 1 hour

**calculate_remaining_budget** (`server/src/tools/budget.tool.ts`):

- Pure computation -- no external API calls
- Calculates total spent, remaining, percentage breakdowns by category
- Returns `over_budget` flag and warning message when applicable

**get_destination_info** (`server/src/tools/destination.tool.ts`):

- Local lookup table with 24 major cities
- Returns IATA code, country, timezone, currency, best time to visit
- Returns error message for unknown cities

**update_trip** (dispatched in `server/src/tools/executor.ts`):

- Updates trip record in PostgreSQL with destination, dates, origin, budget
- Requires `ToolContext` (tripId + userId) for authorization

**format_response** (handled in chat handler):

- Required as the agent's final tool call every turn
- Accepts `text` (markdown), `citations`, `quick_replies`, and optional `advisory` escalation
- All agent text output goes through this tool -- Claude does not produce free-form text outside it
- The handler converts this into `text`, `quick_replies`, and `advisory` ChatNodes

### Node Builder Layer

`server/src/services/node-builder.ts` maps raw tool results to `ChatNode` objects:

| Tool result                  | ChatNode produced  |
| ---------------------------- | ------------------ |
| `search_flights`             | `flight_tiles`     |
| `search_hotels`              | `hotel_tiles`      |
| `search_car_rentals`         | `car_rental_tiles` |
| `search_experiences`         | `experience_tiles` |
| `calculate_remaining_budget` | `budget_bar`       |
| Other tools                  | `null` (no node)   |

The node builder also normalizes raw API response shapes into the clean `Flight`, `Hotel`, `CarRental`, and `Experience` interfaces from `shared-types`, assigning UUIDs in the process.

### Auto-Enrichment Service

`server/src/services/enrichment.ts` is called by the chat handler after a destination is resolved. It returns a `ChatNode[]` that is appended to the message stream automatically, without any agent tool calls:

| Source                               | Output                                            |
| ------------------------------------ | ------------------------------------------------- |
| US State Dept advisory API           | `advisory` node (severity: info/warning/critical) |
| UK FCDO advisory API                 | `advisory` node                                   |
| Open-Meteo forecast API              | `weather_forecast` node (7-day)                   |
| Visa matrix (static lookup)          | `advisory` node with visa requirements            |
| Driving requirements (static lookup) | `advisory` node with traffic side, license info   |

The service uses `Promise.allSettled` for the async sources, so a failure from any single source does not block the others. Coordinates for 25 cities are embedded in the service; destinations not in the list silently skip enrichment.

### Typed Chat Protocol

`packages/shared-types/src/nodes.ts` defines the `ChatNode` discriminated union with 12 variants:

| Type               | Description                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| `text`             | Markdown content with optional citations array                              |
| `flight_tiles`     | Flight search results, selectable                                           |
| `hotel_tiles`      | Hotel search results, selectable                                            |
| `car_rental_tiles` | Car rental search results, selectable                                       |
| `experience_tiles` | Experience/activity search results, selectable                              |
| `travel_plan_form` | Structured form for collecting trip details                                 |
| `itinerary`        | Day-by-day plan (array of `DayPlan`)                                        |
| `advisory`         | Travel advisory, visa info, driving rules (severity: info/warning/critical) |
| `weather_forecast` | 7-day weather outlook (array of `WeatherDay`)                               |
| `budget_bar`       | Budget allocation tracker (allocated, total, currency)                      |
| `quick_replies`    | Suggested next action buttons                                               |
| `tool_progress`    | Tool execution status indicator (running/done)                              |

The `ChatNodeOfType<T>` helper type extracts a specific variant for narrowly-typed component props.

### SSE Protocol

The chat endpoint emits these typed SSE event shapes (defined in `SSEEvent` in shared-types):

| Event type      | Payload                          | Purpose                          |
| --------------- | -------------------------------- | -------------------------------- |
| `node`          | `{ node: ChatNode }`             | A complete node ready to display |
| `text_delta`    | `{ content: string }`            | Streaming text fragment          |
| `tool_progress` | `{ tool_id, tool_name, status }` | Tool execution start/completion  |
| `done`          | `{}`                             | Stream complete                  |
| `error`         | `{ error: string }`              | Error condition                  |

### Middleware Stack

Applied in this order in `server/src/app.ts`:

1. `helmet()` -- security headers
2. `corsConfig` -- CORS with explicit origin allowlist from `CORS_ORIGIN` env var
3. `requestLogger` -- Pino structured logging with request IDs
4. `rateLimiter` -- general rate limiting
5. `express.json({ limit: "10kb" })` -- body parsing with size cap
6. `express.urlencoded({ extended: true, limit: "10kb" })` -- form parsing
7. `cookieParser()` -- parse session cookies
8. `csrfGuard` -- reject state-changing requests without `X-Requested-With`
9. `loadSession` -- read session cookie, attach `req.user` if valid
10. Request timeout (30 seconds)

### Authentication Flow

Custom session-based auth (not Supabase):

- Passwords hashed with bcrypt (12 salt rounds)
- Sessions are random 32-byte tokens; the SHA-256 hash is stored in the `sessions` table
- Registration and login use database transactions (`withTransaction`) to prevent orphan rows
- Login deletes all existing sessions for the user before creating a new one
- Cookie options: `httpOnly`, `sameSite: "none"` in production, `secure` in production
- Session lookup joins `sessions` and `users` tables in one query

### Database Schema

13 migrations in `server/migrations/` create:

| Table              | Purpose                                                                   |
| ------------------ | ------------------------------------------------------------------------- |
| `users`            | Email, password hash, first/last name                                     |
| `sessions`         | Session ID (SHA-256 hash), user_id, expires_at                            |
| `trips`            | Destination, origin, dates, budget, travelers, preferences, status        |
| `trip_flights`     | Selected flights for a trip (origin, destination, airline, price, etc.)   |
| `trip_hotels`      | Selected hotels (name, city, star rating, prices, dates)                  |
| `trip_experiences` | Selected experiences (name, category, rating, estimated cost)             |
| `trip_car_rentals` | Selected car rentals (provider, car name, type, price, dates)             |
| `conversations`    | One conversation per trip (1:1 relationship, UPSERT on trip_id)           |
| `messages`         | Dual-column: `nodes` JSONB for UI + `content`/`tool_calls_json` for agent |
| `api_cache`        | Unused (caching moved to Redis)                                           |
| `tool_call_log`    | Observability: tool name, input/result JSON, latency, cache hit, error    |
| `user_preferences` | Dietary restrictions, travel intensity, social style per user             |

The `messages` table uses a **dual-column pattern**: `nodes` (JSONB `ChatNode[]`) is the display representation; `content` + `tool_calls_json` are the API conversation representation. These evolve independently. Two new columns support the typed protocol: `schema_version` (INTEGER) for forward-compatible rendering, and `sequence` (INTEGER, unique per conversation) for strict ordering.

### System Prompt

`server/src/prompts/system-prompt.ts` builds a consolidated system prompt that:

- Instructs Claude to search flights first (largest cost), then car rentals (if appropriate), then hotels, then experiences
- Requires `calculate_remaining_budget` after each booking category
- Requires `update_trip` as the first tool call when user provides destination/dates/budget
- Requires `format_response` as the LAST tool call every turn (all agent text goes through this tool)
- Includes a topic guardrail (travel-only)
- Injects the current date to prevent past-date searches
- Appends `TripContext` with current trip details, selected bookings, and user preferences

## Frontend Architecture

### App Router Structure

```
web-client/src/app/
  layout.tsx              -- Root layout (Header, Footer, VibeLensBar, providers)
  page.tsx                -- Landing page (hero, demo, features, CTA)
  globals.scss            -- Global styles and CSS custom properties
  (auth)/
    login/page.tsx        -- Login form
    register/page.tsx     -- Registration form
  (protected)/
    layout.tsx            -- Auth guard wrapper
    trips/
      page.tsx            -- Trip list with delete (optimistic updates)
      new/page.tsx        -- Auto-creates trip and redirects to detail
      [id]/page.tsx       -- Trip detail: cost breakdown, itinerary, ChatBox
    account/page.tsx      -- Profile, preferences, usage stats
  faq/page.tsx            -- FAQ page
```

### Key Components

**ChatBox** (`web-client/src/components/ChatBox/ChatBox.tsx`):
The main conversational interface. Coordinates the `useSSEChat` hook, `VirtualizedChat`, and booking action buttons. Handles the `TripDetailsForm` detection and confirmation flow.

**useSSEChat** (`web-client/src/components/ChatBox/useSSEChat.ts`):
Custom hook that manages the SSE stream lifecycle. Reads typed `SSEEvent` objects from the stream and accumulates `streamingNodes` (complete ChatNodes ready to render), `toolProgress` (running/done tool indicators), and `streamingText` (partial text delta). On stream completion, invalidates TanStack Query caches for messages and the trip.

**VirtualizedChat** (`web-client/src/components/ChatBox/VirtualizedChat.tsx`):
Renders the message list using `@tanstack/react-virtual`. Each `ChatMessage` contains a `nodes: ChatNode[]` array. The virtualizer estimates row heights by node type (e.g., `flight_tiles` = 240px, `budget_bar` = 48px) and measures actual heights after render. Streaming messages are composed into a synthetic `__streaming__` message appended to the list during active turns.

**NodeRenderer** (`web-client/src/components/ChatBox/NodeRenderer.tsx`):
Component registry -- a switch statement over `ChatNode['type']` that renders the appropriate component. TypeScript's exhaustiveness check ensures every node type in the discriminated union has a registered component. Accepts a `NodeRendererCallbacks` interface for selection/confirmation handlers.

**Node Components** (`web-client/src/components/ChatBox/nodes/`):

- `FlightTiles` -- Renders airline, route, departure time, price. Selectable.
- `HotelTiles` -- Renders hotel image, name, star rating, price per night, total. Selectable.
- `CarRentalTiles` -- Renders provider logo, car name, type, price per day, features. Selectable.
- `ExperienceTiles` -- Renders name, category, rating, estimated cost. Selectable.
- `AdvisoryCard` -- Renders travel advisories with severity styling (info/warning/critical).
- `WeatherForecast` -- Renders 7-day forecast with high/low temperatures and condition icons.
- `BudgetBar` -- Visual progress bar showing allocated vs. total budget with over-budget state.
- `MarkdownText` -- Renders agent text with `react-markdown` and inline citations.
- `ToolProgressIndicator` -- Hourglass/checkmark per tool call.

**Widget Components** (`web-client/src/components/ChatBox/widgets/`):

- `QuickReplyChips` -- Renders clickable chip buttons for suggested next actions.
- `ItineraryTimeline` -- Renders day-by-day itinerary.
- `TripDetailsForm` -- Inline form for collecting origin, dates, budget, travelers.

**BookingConfirmation** (`web-client/src/components/BookingConfirmation/BookingConfirmation.tsx`):
Modal overlay with three stages: review (cost breakdown + confirm/cancel), booking (spinner animation), confirmed (checkmark animation). Auto-advances between stages.

### State Management

- **TanStack Query** handles all server state. Query keys: `["auth", "me"]`, `["trips"]`, `["trips", id]`, `["messages", tripId]`, `["preferences"]`.
- **`useSSEChat`** manages streaming state (nodes, tool progress, streaming text) as component-local state.
- **`VirtualizedChat`** receives all rendering inputs as props from the ChatBox parent.
- **AuthContext** (`web-client/src/context/AuthContext.tsx`): Wraps the app. Uses TanStack Query internally for `/auth/me`. Provides `user`, `isLoading`, `login`, `signup`, `logout`.
- No client-side store (no Redux, no Zustand) -- all state is server-derived or component-local.

### API Client

`web-client/src/lib/api.ts` exports `get`, `post`, `put`, `del` functions that:

- Prepend `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001`)
- Include `credentials: "include"` for session cookies
- Include `X-Requested-With: XMLHttpRequest` for CSRF
- Throw `ApiError` with status code and error message on non-2xx responses

The chat endpoint is called directly via `fetch` (inside `useSSEChat`, not the API client) because it requires SSE stream reading.

### Styling

- SCSS Modules for component-scoped styles
- CSS custom properties defined in `globals.scss`
- No Tailwind, no CSS-in-JS
- Each component has a co-located `.module.scss` file

## Testing Strategy

### Unit Tests (Vitest)

- Every handler, repository, tool, middleware, and service has co-located `*.test.ts` files
- Tools mock `serpapi.service.ts` and `cache.service.ts` with `vi.mock()`
- `AgentOrchestrator.test.ts` tests the full agentic loop with mock Claude responses
- Test utilities in `server/src/utils/tests/`: `mockResult.ts`, `mockLogger.ts`, `responseHelpers.ts`, `uuids.ts`

### Integration Tests

- `server/src/__integration__/auth.integration.test.ts` -- tests auth flow against real Express routes
- `server/src/__integration__/cors.integration.test.ts` -- tests CORS headers
- Require a real PostgreSQL database via `DATABASE_URL`

### E2E Tests (Playwright)

- `e2e/` directory at project root
- Configuration in `playwright.config.ts`

### Smoke Tests

- `scripts/smoke-test.sh` verifies health endpoints and service startup

## Security

- Helmet.js for security headers
- CORS with explicit origin allowlist (no wildcard)
- CSRF protection via `X-Requested-With` header requirement
- Rate limiting on all routes (general) and auth routes (stricter)
- Session tokens stored as SHA-256 hashes (database leak does not expose sessions)
- Request body size limited to 10KB
- Request timeout of 30 seconds
- Password hashing with bcrypt (12 rounds)
- `httpOnly` + `secure` + `sameSite` cookie flags
