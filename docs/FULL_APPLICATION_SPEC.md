# Voyager

**Portfolio demo of an agentic AI travel planning pattern**
**Repo:** `voyager` (formerly `agentic-travel-agent`; internal package names under `@agentic-travel-agent/` still reflect the original name for lockfile stability)

## Product Summary

A travel planning assistant powered by an agentic tool-use loop. Users describe a trip (destination, dates, budget, preferences) and an AI agent searches real flight, hotel, and experience APIs, reasons about the budget, and assembles a complete itinerary. Users iterate conversationally: "find cheaper flights", "add a cooking class", "switch to a beachfront hotel". The agent re-plans around constraints in real time. This is the portfolio piece for agentic AI: multi-step tool calling with real external APIs, budget-aware reasoning, and streaming progress updates.

## Hosting & Infrastructure

| Service          | Provider                 | Notes                                    |
| ---------------- | ------------------------ | ---------------------------------------- |
| Frontend         | Vercel                   | Next.js                                  |
| API Server       | Railway                  | Express + TypeScript                     |
| Worker           | Railway                  | BullMQ (cache warming, PDF generation)   |
| Database         | Neon                     | PostgreSQL                               |
| Cache/Queue      | Railway Redis            | BullMQ + API response cache              |
| Auth             | Supabase Auth            | Via `@supabase/ssr`                      |
| LLM              | Anthropic Claude API     | Tool use / function calling, streaming   |
| Flights + Hotels | Amadeus Self-Service API | Flight Offers Search v2, Hotel Search v3 |
| Experiences      | Google Places API (New)  | Text Search, Place Details               |

**Amadeus:** The self-service tier is free and provides a test environment with realistic data. Authentication is OAuth2 client credentials (client_id + client_secret -> access token with 30-minute TTL). Rate limits are strict (10 requests/second on test), so aggressive caching is essential.

**Google Places:** Places API (New) uses API key authentication. The Text Search endpoint supports category filtering (e.g., "cooking class in Barcelona") and returns pricing level, ratings, and opening hours.

## Project Setup

Monorepo: `packages/api`, `packages/worker`, `packages/web`, `packages/common`. Start from **Express + Next.js templates**. Reuse from prior apps:

- Streaming SSE pattern from App 2
- BullMQ worker pattern from App 3
- Tool calling pattern from App 3 (expanded to multi-turn agentic loop)
- Conversation persistence from App 5
- Prompt assembly pattern from App 5

## Core User Stories

1. As a user, I can describe a trip (destination, dates, budget, preferences) and the agent searches flights, hotels, and experiences to build an itinerary.
2. As a user, I can see progress updates as the agent works ("Searching flights...", "Found 12 options, selecting best match...", "Searching hotels with remaining budget...").
3. As a user, I can view a complete itinerary with flights, hotel, experiences, and a cost breakdown against my budget.
4. As a user, I can iterate: "find cheaper flights", "add a museum tour", "change the hotel to something closer to downtown".
5. As a user, I can save a trip plan and return to it later to continue editing.
6. As a user, I can view my saved trips and their conversation history.

## Infrastructure

**Hosting:** Vercel (Next.js frontend) + Railway (Express API + BullMQ worker) + Supabase (Postgres, Auth)
**Auth:** Supabase Auth via `@supabase/ssr`. All trip and conversation data is user-scoped.
**Database:** Supabase Postgres
**Cache/Queue:** Railway Redis. API response caching is critical — Amadeus rate limits are 10 req/s on test tier, and Google Places charges per request. Cache flight/hotel/experience search results with a 1-hour TTL keyed by normalized query parameters. BullMQ handles background jobs (cache warming, optional PDF generation).
**Template:** Next.js template (frontend) + Express API template (backend). Monorepo with shared types. The agentic loop runs synchronously on the API server (not queued to BullMQ) because the agent needs immediate results to reason about. BullMQ is for background tasks only.

## System Design

```
Next.js Frontend (Vercel)
  |
  +-- Trip planner chat interface
  +-- Progress indicators (agent status, tool calls in flight)
  +-- Itinerary display (flights, hotels, experiences, budget)
  +-- Saved trips list
  +-- Trip detail view (itinerary + conversation history)

Express API Server (Railway)
  |
  +-- Auth (Supabase)
  +-- Trips
  |     +-- POST /trips (create new trip with initial preferences)
  |     +-- GET /trips (list user's saved trips)
  |     +-- GET /trips/:id (trip detail with itinerary)
  |     +-- DELETE /trips/:id
  |
  +-- Chat (POST /trips/:id/chat, SSE)
  |     +-- Load conversation history
  |     +-- Load current trip state (selected flights, hotels, etc.)
  |     +-- Send to Claude with tool definitions
  |     +-- AGENT LOOP:
  |     |     +-- Claude responds with tool_use blocks
  |     |     +-- Server executes tool calls against external APIs
  |     |     +-- Send progress events to frontend via SSE
  |     |     +-- Feed tool_results back to Claude
  |     |     +-- Repeat until Claude produces text response
  |     +-- Persist messages + tool call log
  |     +-- Update trip selections if agent made changes
  |
  +-- Conversations (GET /trips/:id/messages)

Agent Tool Execution Layer
  |
  +-- search_flights -> Amadeus Flight Offers Search v2
  +-- search_hotels -> Amadeus Hotel Search v3
  +-- search_experiences -> Google Places Text Search
  +-- calculate_remaining_budget -> local computation
  +-- get_destination_info -> Google Places + cached knowledge

External APIs
  +-- Amadeus (OAuth2 client credentials, 30-min token TTL)
  |     +-- Flight Offers Search v2
  |     +-- Hotel Search v3 (by city code)
  +-- Google Places API (New)
        +-- Text Search (category + location)
        +-- Place Details (pricing, hours, photos)

BullMQ Worker (Railway)
  +-- cache-warm queue
  |     +-- Pre-cache popular route searches
  |     +-- Refresh expiring cache entries
  +-- pdf-generation queue (optional)
        +-- Generate itinerary PDF from trip data

PostgreSQL (Neon)
  +-- users (id, email, name, created_at)
  +-- trips (id, user_id, destination, origin, departure_date, return_date,
             budget_total, budget_currency, travelers, preferences,
             status, created_at, updated_at)
       preferences JSONB: { style: 'luxury'|'budget'|'mid-range',
                            pace: 'relaxed'|'moderate'|'packed',
                            interests: string[] }
       status IN ('planning', 'saved', 'archived')
  +-- trip_flights (id, trip_id, amadeus_offer_id, origin, destination,
                    departure_time, arrival_time, airline, flight_number,
                    price, currency, cabin_class, data_json, selected,
                    created_at)
  +-- trip_hotels (id, trip_id, amadeus_hotel_id, name, address, city,
                   star_rating, price_per_night, total_price, currency,
                   check_in, check_out, data_json, selected, created_at)
  +-- trip_experiences (id, trip_id, google_place_id, name, category,
                        address, rating, price_level, estimated_cost,
                        data_json, selected, created_at)
  +-- conversations (id, trip_id, created_at, updated_at)
  +-- messages (id, conversation_id, role, content, tool_calls_json,
                token_count, created_at)
       role IN ('user', 'assistant', 'tool')
       tool_calls_json: array of { tool_name, tool_input, tool_result }
  +-- api_cache (id, cache_key, provider, endpoint, request_hash,
                 response_json, expires_at, created_at)
       provider IN ('amadeus', 'google_places')
  +-- tool_call_log (id, conversation_id, message_id, tool_name,
                     tool_input_json, tool_result_json, latency_ms,
                     cache_hit, error, created_at)

Redis (Railway)
  +-- BullMQ queues: cache-warm, pdf-generation
  +-- amadeus:token (cached OAuth2 access token)
  +-- api_cache:{provider}:{hash} (hot cache, mirrors DB api_cache)
```

### AI Integration Detail

**Agentic tool-use loop:** This is the core differentiator. Unlike App 3 where the LLM calls tools once to process content, here the agent reasons across multiple tool calls within a single turn. Claude receives the user's request, calls `search_flights`, examines the results, calculates remaining budget, then calls `search_hotels` with a price constraint derived from the flight cost, examines those results, then searches for experiences with whatever budget remains. It may call tools 3-8 times per user message.

**Tool definitions:**

- `search_flights(origin, destination, departure_date, return_date, max_price, passengers, cabin_class)` — Calls Amadeus Flight Offers Search v2. Returns top 5 options sorted by price. Origin/destination are IATA codes; the system prompt instructs Claude to use them or call `get_destination_info` first to resolve city names.
- `search_hotels(city_code, check_in, check_out, max_price_per_night, guests, star_rating_min)` — Calls Amadeus Hotel Search v3. Returns top 5 options. City code is IATA; resolved via `get_destination_info` if needed.
- `search_experiences(location, categories, max_price_per_person, limit)` — Calls Google Places Text Search with a constructed query (e.g., "cooking class in Barcelona"). Categories map to Google Places types. Returns name, rating, price level, address.
- `calculate_remaining_budget(total_budget, flight_cost, hotel_total_cost, experience_costs)` — Pure computation. Returns remaining budget, percentage spent per category, and a warning if over budget. This tool helps the agent stay within constraints without doing mental math.
- `get_destination_info(city_name)` — Returns IATA code, country, timezone, currency, current weather summary, and best time to visit. Combines cached data with Google Places for geocoding.

**Agent loop implementation:**

1. Express endpoint receives user message + trip context
2. Build messages array: system prompt + conversation history + current message
3. Call `anthropic.messages.create()` with tools and `max_tokens`
4. Check response `stop_reason`:
   - If `tool_use`: extract tool calls, execute against APIs (with cache check), build `tool_result` messages, append to messages array, send progress SSE event, go to step 3
   - If `end_turn`: extract text response, stream to frontend, persist everything
5. Safety: max 15 tool calls per turn to prevent infinite loops

**Progress streaming:** During the agent loop, the server sends SSE events for each tool call:

```
event: tool_start
data: {"tool": "search_flights", "input": {"origin": "SFO", "destination": "BCN", ...}}

event: tool_result
data: {"tool": "search_flights", "summary": "Found 8 flights, cheapest $450"}

event: assistant
data: {"delta": "Based on the flight options..."}
```

**System prompt design:** The system prompt defines the agent's persona (helpful travel planner), instructs it to always check budget before making selections, explains the tool capabilities, and provides guidelines:

- Always search flights first (largest variable cost)
- Calculate remaining budget after each major booking category
- Present options with price transparency
- If over budget, proactively suggest alternatives
- Use IATA codes for Amadeus APIs; call `get_destination_info` to resolve city names

**Conversation memory:** Full conversation history including tool calls and results is persisted. On subsequent turns, the full history is loaded (with tool results summarized if the context grows too large). The current trip state (selected flights, hotels, experiences) is injected into the system prompt so the agent always knows the current plan.

### Amadeus API Integration

- **Authentication:** OAuth2 client credentials grant. POST to `/v1/security/oauth2/token` with client_id and client_secret. Token valid for 30 minutes. Cache in Redis with TTL.
- **Flight Offers Search v2:** `GET /v2/shopping/flight-offers` with originLocationCode, destinationLocationCode, departureDate, returnDate, adults, max. Returns offers with price, itineraries, segments.
- **Hotel Search v3:** `GET /v3/shopping/hotel-offers` with hotelIds or cityCode, checkInDate, checkOutDate, adults. Returns hotel name, rating, price, amenities.
- **Rate limits (test):** 10 calls/second. Cache aggressively. Normalize query params to maximize cache hits (sort params, lowercase, strip whitespace).
- **Error handling:** 429 (rate limit) -> exponential backoff with jitter. 401 (expired token) -> refresh and retry. Amadeus test data may return empty results for obscure routes — the agent should handle this gracefully and suggest alternatives.

### Google Places API Integration

- **Authentication:** API key in request header (`X-Goog-Api-Key`).
- **Text Search (New):** `POST /v1/places:searchText` with textQuery (e.g., "museum in Paris"), locationBias, maxResultCount. Returns places with displayName, rating, priceLevel, formattedAddress.
- **Place Details:** `GET /v1/places/{place_id}` for additional info (reviews, opening hours, photos).
- **Field masking:** Use `X-Goog-FieldMask` to request only needed fields (reduces billing).
- **Cost:** Text Search is $32 per 1000 requests (Basic), Place Details varies by fields. Cache results aggressively.

## Tasks

### POC (Days 1-3): One message, agent searches flights and hotels, returns itinerary

Deliver the core agentic loop: a user sends a trip request (destination, dates, budget), the Express API sends it to Claude with tool definitions, Claude calls `search_flights` (hitting the Amadeus test API), examines results, calls `calculate_remaining_budget`, then calls `search_hotels` with a budget-constrained price, and produces a text response with a basic itinerary and cost breakdown. The frontend displays a chat input, progress indicators for each tool call, and the streaming itinerary response. Amadeus OAuth2 token management and basic response caching are in place. Deploy API on Railway, frontend on Vercel.

- [ ] Scaffold from templates (monorepo: api, worker, web, common)
- [ ] PostgreSQL schema: trips, trip_flights, trip_hotels, conversations, messages, api_cache, tool_call_log
- [ ] Amadeus OAuth2 client: token fetch, cache in Redis, auto-refresh
- [ ] Amadeus flight search integration (Flight Offers Search v2)
- [ ] Amadeus hotel search integration (Hotel Search v3)
- [ ] Tool definitions: search_flights, search_hotels, calculate_remaining_budget
- [ ] Agent loop: Claude tool_use -> execute -> tool_result -> repeat until text
- [ ] POST /trips/:id/chat endpoint with SSE streaming
- [ ] Progress events during tool execution (tool_start, tool_result)
- [ ] API response caching (Redis + api_cache table, 1-hour TTL)
- [ ] Frontend: chat input, progress indicators, streaming response display
- [ ] Deploy: API on Railway, frontend on Vercel

### Week 1 Remainder: Full agent + experiences + persistence

Deliver the complete five-tool agent: add `search_experiences` (Google Places Text Search), `get_destination_info` (IATA code resolution, timezone, weather), and wire all five tools into the agent loop with the 15-call safety limit. Implement trip persistence (create, save selections, list, load), full conversation persistence with tool call logging, the itinerary display component showing selected flights, hotels, and experiences with cost breakdown, and multi-turn iteration where the agent modifies the plan based on follow-up requests ("find cheaper flights", "add a cooking class"). The agent should reference current trip state when replying.

- [ ] Google Places Text Search integration (experiences/activities)
- [ ] Tool definition: search_experiences
- [ ] Tool definition: get_destination_info (IATA codes, timezone, weather)
- [ ] Agent loop safety: max 15 tool calls per turn
- [ ] Trip CRUD: POST /trips, GET /trips, GET /trips/:id, DELETE /trips/:id
- [ ] Trip selection persistence (mark flights/hotels/experiences as selected)
- [ ] Conversation persistence with full tool call history
- [ ] tool_call_log table: every invocation with latency, cache hit, error
- [ ] Inject current trip state into system prompt for multi-turn context
- [ ] Multi-turn iteration: agent modifies plan based on follow-up messages
- [ ] Cache normalization: consistent key generation for API response cache
- [ ] Rate limit handling: exponential backoff for Amadeus 429 responses

### Week 2: Frontend + Polish + Ship

Deliver the full Next.js frontend: a trip creation form (destination, dates, budget, preference sliders for style/pace/interests), a chat interface with real-time progress indicators showing each tool call as it executes, a streaming itinerary display with flight cards (airline, times, price), hotel cards (name, stars, price, location), and experience cards (name, rating, category, estimated cost), a budget breakdown visualization, a saved trips list, and a trip detail view with conversation history. Implement the BullMQ worker for cache warming of popular routes. Ship with integration tests covering the agent loop (mocked APIs), Amadeus/Google Places client tests, and a comprehensive README documenting the agentic architecture, tool definitions, API integration details, and a demo walkthrough showing the multi-step reasoning.

- [ ] Frontend: trip creation form (destination, dates, budget, preferences)
- [ ] Frontend: chat interface with streaming responses
- [ ] Frontend: progress indicators per tool call (animated status)
- [ ] Frontend: itinerary display (flight cards, hotel cards, experience cards)
- [ ] Frontend: budget breakdown visualization (bar chart or progress bars)
- [ ] Frontend: saved trips list
- [ ] Frontend: trip detail view with itinerary + conversation history
- [ ] Frontend: responsive layout (mobile-friendly itinerary view)
- [ ] BullMQ worker: cache warming for popular routes
- [ ] Agent system prompt refinement and testing
- [ ] Integration tests: agent loop with mocked APIs
- [ ] Integration tests: Amadeus client (token refresh, rate limit, error handling)
- [ ] Integration tests: Google Places client
- [ ] Integration tests: cache hit/miss behavior
- [ ] README: agentic architecture diagram, tool definitions, API integration, demo walkthrough
- [ ] Final deploy + smoke test

## Key Decisions to Document

- Why synchronous tool execution in the agent loop (not queued to BullMQ) — the agent needs immediate results to reason
- Amadeus test vs. production tier (test is free, realistic data, sufficient for portfolio)
- Cache strategy: Redis hot cache + Postgres cold cache, TTL selection
- Tool call safety limit (15 per turn) and how it prevents runaway loops
- Budget tracking: server-side via tool vs. letting the LLM do arithmetic
- Conversation memory with tool results: full storage vs. summarized tool results for long conversations
- Google Places billing optimization: field masking, caching, request minimization
- Why SSE progress events matter for UX (agent takes 10-30 seconds per turn)

## Claude Code Implementation Notes

POC: send "Plan a 5-day trip to Barcelona from SFO, budget $3000" -> agent calls search_flights -> calls calculate_remaining_budget -> calls search_hotels -> returns itinerary with costs. That's the demo. Get the loop working before anything else.

The agent loop is the hardest part. Start with two tools (search_flights + calculate_remaining_budget), get the loop working end-to-end, then add tools one at a time. Don't try to wire up all five tools simultaneously.

Amadeus test API returns real-ish data but not every route exists. Have the agent handle empty results gracefully ("I couldn't find direct flights to that destination. Would you like me to search for nearby airports?").

The tool_call_log table is your observability story. Log every tool invocation with input, output, latency, and cache hit. This is the data you show in interviews to demonstrate production thinking.

```
packages/api/src/
  routes/       -- trip.routes.ts, chat.routes.ts
  services/     -- agent.service.ts (the core loop), amadeus.service.ts,
                   google-places.service.ts, cache.service.ts
  tools/        -- definitions.ts (tool schemas), executor.ts (dispatches tool calls),
                   flights.tool.ts, hotels.tool.ts, experiences.tool.ts,
                   budget.tool.ts, destination.tool.ts
  prompts/      -- system-prompt.ts, trip-context.ts
  middleware/    -- auth.ts

packages/worker/src/
  processors/   -- cache-warmer.ts, pdf-generator.ts (optional)
  index.ts

packages/web/
  app/
    trips/            -- trip list + creation
    trips/[id]/       -- trip detail + chat
  components/
    TripForm/         -- creation form with preference controls
    ChatInterface.tsx  -- message input + streaming display
    ProgressIndicator.tsx  -- tool call progress (animated)
    Itinerary/
      FlightCard.tsx
      HotelCard.tsx
      ExperienceCard.tsx
      BudgetBreakdown.tsx
    TripList.tsx
    StreamingResponse.tsx
  hooks/
    useChat.ts         -- SSE connection + message management
    useTripState.ts    -- current trip context

packages/common/
  types/              -- shared TypeScript types (Trip, Flight, Hotel, Experience, ToolCall)
  schemas/            -- Zod schemas for tool inputs/outputs
```
