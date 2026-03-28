# Agentic Travel Agent — Full Application Description

## Overview

The Agentic Travel Agent is a full-stack AI-powered travel planning application that demonstrates **agentic tool-use loops** — the capstone pattern in a portfolio of eight progressive AI applications. Users describe a trip in natural language (destination, dates, budget, preferences), and an AI agent autonomously searches live flight, hotel, and experience APIs, reasons about budget constraints between each step, and assembles a complete itinerary — all streamed to the frontend in real time.

Unlike simple chatbot wrappers, the agent makes **3–8 sequential tool calls per turn**, examining results, adjusting strategy, and proactively suggesting alternatives when a selection exceeds the budget. This is the key differentiator: the AI is not just answering questions — it is *acting* on the user's behalf across multiple external systems.

---

## Core Features

### 1. Conversational Trip Planning

Users interact through a chat interface. A message like *"Plan a week in Barcelona for two, $4,000 budget, we love food and architecture"* kicks off a multi-step agent loop that searches flights, hotels, and experiences without further prompting.

### 2. Agentic Tool-Use Loop

The heart of the application. When the user sends a message:

1. The server builds a message array (system prompt + conversation history + current message) and sends it to Claude with five tool definitions.
2. Claude responds with one or more `tool_use` blocks (e.g., `search_flights`).
3. The server executes each tool, streams progress events to the frontend, and returns the results to Claude.
4. Claude examines the results, reasons about what to do next, and either calls another tool or produces a final text response.
5. The loop continues until Claude issues an `end_turn` stop reason or the 15-call safety limit is reached.

This produces a natural reasoning chain: search flights → calculate remaining budget → search hotels within budget → search experiences → present itinerary with cost breakdown.

### 3. Live External API Integration

The agent calls real APIs, not mocked data:

- **SerpApi Google Flights** — origin/destination IATA codes, dates, cabin class. Returns best and alternative flight options with prices, airlines, times, and layover info.
- **SerpApi Google Hotels** — city-based hotel search with check-in/out dates. Returns properties with star ratings, prices per night, and amenities.
- **Google Places API (New)** — text search for experiences ("museums in Paris", "cooking classes in Barcelona"). Returns place names, ratings, price levels, and addresses.

Results are normalized to the top 5 options per category, sorted by price.

### 4. Budget-Aware Planning

A dedicated `calculate_remaining_budget` tool performs server-side arithmetic (not LLM arithmetic, which is unreliable). After the agent selects flights, it calls this tool to see what remains for hotels and experiences. If a hotel selection would blow the budget, the agent proactively searches for cheaper alternatives or suggests trade-offs.

### 5. Real-Time Progress Streaming (SSE)

Each tool call emits Server-Sent Events to the frontend:

- `tool_start` — tool name and input parameters (e.g., "Searching flights SFO → BCN...")
- `tool_result` — execution result summary
- `assistant` — final text response

The frontend renders animated progress indicators for each tool, giving users visibility into a process that typically takes 10–30 seconds.

### 6. Multi-Turn Iteration

Conversations persist in the database. Users can follow up with refinements:

- *"Find cheaper flights"*
- *"Switch the hotel to something beachfront"*
- *"Add a cooking class"*
- *"What if we fly out a day later?"*

The agent receives the full conversation history plus the current trip state (selected flights, hotels, experiences) injected into the system prompt, so it always knows what has been chosen and can modify the plan intelligently.

### 7. Trip Persistence & Management

- **Create** trips with destination, dates, budget, traveler count, and preference sliders (luxury vs. budget, pace, interest categories).
- **Save** agent-selected flights, hotels, and experiences to the database.
- **List** all saved trips with status indicators (planning, saved, archived).
- **Load** a previous trip and continue the conversation where you left off.
- **Delete** trips you no longer need.

### 8. Itinerary Display

The frontend renders structured itinerary cards:

- **FlightCard** — airline, departure/arrival times, flight number, price, cabin class
- **HotelCard** — name, star rating, price per night, total price, check-in/out dates
- **ExperienceCard** — name, category, rating, price level, estimated cost
- **BudgetBreakdown** — visual breakdown of spending by category against total budget

### 9. Authentication & Security

- Session-based auth with HTTP-only cookies (not JWTs exposed to JavaScript)
- Passwords hashed with bcrypt (10 rounds)
- CSRF guard middleware
- Rate limiting: 100 req/15 min global, 10 req/15 min on auth endpoints
- Protected routes on both frontend (AuthGuard component) and backend (requireAuth middleware)

### 10. Observability & Tool Call Logging

Every tool invocation is logged to a `tool_call_log` table:

- Tool name, input parameters, result, latency (ms), cache hit flag, error message
- Enables production-grade observability: "The agent called `search_flights` 3 times, 2 were cache hits, average latency 1.2s"

---

## Architecture

### Monorepo Structure

```
agentic-travel-agent/
├── server/           Express API (Railway)
│   ├── src/
│   │   ├── routes/         API route definitions
│   │   ├── handlers/       Request handlers
│   │   ├── services/       Agent loop, caching, SerpApi client
│   │   ├── tools/          5 tool definitions + executor
│   │   ├── prompts/        System prompt + trip context formatter
│   │   ├── repositories/   Database query layer
│   │   ├── middleware/     Auth, CSRF, rate limiting, logging
│   │   ├── schemas/        Zod validation schemas
│   │   └── config/         Environment, CORS
│   └── migrations/         10 node-pg-migrate files
│
└── web-client/       Next.js frontend (Vercel)
    ├── src/
    │   ├── app/            App Router pages
    │   ├── components/     ChatBox, Itinerary cards, TripForm, etc.
    │   ├── context/        AuthContext
    │   ├── hooks/          useChat (SSE), useTripState
    │   ├── lib/            API fetch wrapper
    │   └── styles/         SCSS modules
    └── public/
```

### Tech Stack

| Layer | Technology | Deployment |
|-------|-----------|------------|
| Frontend | Next.js 15, React 19, TypeScript, SCSS, TanStack React Query v5 | Vercel |
| API Server | Express 5, TypeScript, Pino logging | Railway |
| Database | PostgreSQL (Neon), 10 tables, pgvector-ready | Neon |
| Cache | Redis (ioredis), 1-hour TTL | Railway |
| AI | Anthropic Claude API (claude-sonnet-4-20250514), tool use | Anthropic |
| Flight/Hotel Search | SerpApi (Google Flights + Google Hotels engines) | SerpApi |
| Experiences Search | Google Places API (New) — Text Search | Google Cloud |
| Auth | Custom session-based (bcrypt + HTTP-only cookies) | — |
| Testing | Vitest (unit/integration), Playwright (e2e) | — |
| Dev Tools | ESLint, Prettier, Lefthook (git hooks), pnpm workspaces | — |

### Database Schema (10 Tables)

- `users` — email, password hash
- `sessions` — token hash, expiry, linked to user
- `trips` — destination, origin, dates, budget, travelers, preferences (JSONB), status enum
- `trip_flights` — flight details, price, selected flag, raw data (JSONB)
- `trip_hotels` — hotel details, star rating, pricing, selected flag
- `trip_experiences` — place details, rating, category, estimated cost, selected flag
- `conversations` — one per trip (1:1 relationship)
- `messages` — role (user/assistant/tool), content, tool calls (JSONB), token count
- `api_cache` — provider-scoped cache with TTL, request hash for deduplication
- `tool_call_log` — observability: tool name, input/output, latency, cache hit, errors
- `user_preferences` — key-value user settings

### Caching Strategy

Two-tier caching maximizes API quota efficiency (SerpApi free tier: 250 searches/month):

1. **Hot cache (Redis)** — 1-hour TTL, normalized cache keys (sorted params, lowercase)
2. **Cold cache (PostgreSQL `api_cache`)** — persistent, provider-scoped, with expiry timestamps

Cache key normalization ensures that `{origin: "SFO", destination: "BCN"}` and `{destination: "BCN", origin: "SFO"}` produce the same key.

---

## Build Philosophy

This application was built following a three-phase approach:

### Phase 1: POC (Days 1–3)

Get the core agentic loop working end-to-end, deployed. A user sends a trip request, Claude searches flights, calculates budget, searches hotels, and returns an itinerary. SSE progress events stream to the frontend. API deployed on Railway, frontend on Vercel.

### Phase 2: Week 1

Add all five tools. Implement the 15-call safety limit. Full trip persistence (create, save, list, load). Conversation history with tool call logging. Itinerary display components. Multi-turn iteration.

### Phase 3: Week 2

Complete the frontend (forms, chat, cards, budget breakdown). Real-time progress indicators. Trip creation with preference sliders. Saved trips management. Integration tests with mocked APIs. Polish and ship.

### Key Design Decisions

- **Synchronous tool execution** — The agent needs immediate results to reason about. BullMQ async processing (used in earlier apps) is wrong here; the loop must block on each tool call.
- **Server-side budget calculation** — LLMs are unreliable at arithmetic. A dedicated tool ensures correct budget tracking.
- **SerpApi over direct Amadeus/Google** — Simpler integration, normalized responses, adequate for a portfolio project.
- **15-call safety limit** — Prevents runaway agent loops from burning API quota or hanging.
- **Full conversation memory** — Not summarized. The agent sees every prior message and tool result for maximum context.
- **SSE over WebSockets** — Simpler, unidirectional (server → client), sufficient for progress streaming.

---

## Suggested Next Steps

### Near-Term Enhancements

1. **PDF Itinerary Export** — Generate downloadable PDF itineraries with all flight, hotel, and experience details formatted for printing or sharing.
2. **Email Itinerary Sharing** — Send formatted itinerary summaries via Resend transactional email.
3. **BullMQ Cache Warming Worker** — Background worker that pre-warms cache for popular routes and destinations during off-peak hours.
4. **Streaming Text Responses** — Stream Claude's final text response token-by-token (currently sent as a complete block).
5. **Selection Persistence** — Let users click to select/deselect individual flights, hotels, and experiences from search results, persisting selections to the database.

### Medium-Term Features

6. **Trip Sharing & Collaboration** — Share trip links with travel companions. Multiple users can view and comment on the same itinerary.
7. **Price Alerts** — Monitor saved trips for price changes on flights and hotels. Notify users when prices drop.
8. **Calendar Integration** — Export itineraries to Google Calendar or Apple Calendar with proper event times and locations.
9. **Map Visualization** — Display hotels and experiences on an interactive map (Mapbox or Google Maps embed) for spatial planning.
10. **Preference Learning** — Track which suggestions users accept vs. reject. Use patterns to improve future recommendations.

### Long-Term Vision

11. **Multi-City Trip Planning** — Support complex itineraries with multiple stops (Paris → Barcelona → Rome).
12. **Group Trip Budget Splitting** — Split costs across travelers with per-person budget tracking.
13. **Real-Time Booking Integration** — Move from search-only to actual booking via affiliate links or direct API booking.
14. **RAG-Enhanced Destination Knowledge** — Ingest travel guides and reviews into a vector database (reusing patterns from App 4) for richer destination context.
15. **Mobile App** — React Native frontend sharing the same API backend.
