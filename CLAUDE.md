# App 8: Agentic Travel Agent

AI travel planner powered by a multi-step tool-use loop. Users describe a trip (destination, dates, budget, preferences). The agent calls real APIs (Amadeus for flights/hotels, Google Places for experiences), reasons about budget constraints, and assembles a complete itinerary. Users iterate conversationally.

## Key AI pattern
Agentic tool-use loop: Claude calls tools 3-8 times per turn, reasoning about results between calls. Unlike app 3 (single-pass tool use), this is multi-step with budget-aware planning. Max 15 tool calls per turn as safety limit.

## Tools the agent uses
- `search_flights` → Amadeus Flight Offers Search v2
- `search_hotels` → Amadeus Hotel Search v3
- `search_experiences` → Google Places Text Search
- `calculate_remaining_budget` → local computation
- `get_destination_info` → IATA codes, weather, timezone

## Stack
- Monorepo: `packages/api`, `packages/worker`, `packages/web`, `packages/common`
- Next.js on Vercel, Express + BullMQ worker on Railway
- PostgreSQL on Neon, Redis on Railway
- Amadeus API (OAuth2, self-service test tier)
- Google Places API (New) with API key
- Anthropic Claude API (tool use + streaming)

## MCP servers for development
- `amadeus` — test flight/hotel searches directly
- `google-maps` — test place searches directly
- `railway` — deploy API + worker
- `vercel` — deploy frontend

## Spec
Read `FULL_APPLICATION_SPEC.md` for full system design, DB schema, API integration details, and task breakdown.

## Build order
POC → send "Plan a trip to Barcelona, $3000 budget" → agent calls search_flights → calculate_remaining_budget → search_hotels → returns itinerary. Get the loop working with 2 tools first, then add the rest one at a time.

## Critical implementation note
The agent loop runs synchronously on the API server (not BullMQ). The agent needs immediate results to reason. BullMQ is only for background tasks (cache warming). Cache Amadeus responses aggressively — 10 req/s rate limit on test tier.
