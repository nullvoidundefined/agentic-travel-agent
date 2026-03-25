# App 8: Agentic Travel Agent

AI travel planner powered by a multi-step tool-use loop. Users describe a trip (destination, dates, budget, preferences). The agent calls real APIs (SerpApi for flights/hotels via Google Flights & Hotels, Google Places for experiences), reasons about budget constraints, and assembles a complete itinerary. Users iterate conversationally.

## Key AI pattern
Agentic tool-use loop: Claude calls tools 3-8 times per turn, reasoning about results between calls. Unlike app 3 (single-pass tool use), this is multi-step with budget-aware planning. Max 15 tool calls per turn as safety limit.

## Tools the agent uses
- `search_flights` → SerpApi Google Flights
- `search_hotels` → SerpApi Google Hotels
- `search_experiences` → Google Places Text Search
- `calculate_remaining_budget` → local computation
- `get_destination_info` → IATA codes, weather, timezone

## Stack
- Monorepo: `packages/api`, `packages/worker`, `packages/web`, `packages/common`
- Next.js on Vercel, Express + BullMQ worker on Railway
- PostgreSQL on Neon, Redis on Railway
- SerpApi (Google Flights + Hotels, free tier: 250 searches/month)
- Google Places API (New) with API key
- Anthropic Claude API (tool use + streaming)

## MCP servers for development
- `google-maps` — test place searches directly
- `railway` — deploy API + worker
- `vercel` — deploy frontend

## Spec
Read `FULL_APPLICATION_SPEC.md` for full system design, DB schema, API integration details, and task breakdown.

## Build order
POC → send "Plan a trip to Barcelona, $3000 budget" → agent calls search_flights → calculate_remaining_budget → search_hotels → returns itinerary. Get the loop working with 2 tools first, then add the rest one at a time.

## Critical implementation note
The agent loop runs synchronously on the API server (not BullMQ). The agent needs immediate results to reason. BullMQ is only for background tasks (cache warming). Cache SerpApi responses aggressively — 250 searches/month on free tier.

## Frontend conventions
- Use **TanStack Query** (React Query) for all server state — data fetching, caching, mutations, and optimistic updates. No raw useEffect + fetch patterns.
- Use **Toast** component for API/server errors — never show raw error messages or stack traces inline. Keep inline `{error}` only for form validation messages.

## Vercel deploy caveats
- Do NOT set `outputFileTracingRoot` in `next.config.ts`. It causes a double-nested path error on Vercel (`/vercel/path0/path0/.next/routes-manifest.json` ENOENT) because Vercel already resolves the project root correctly.
- There are two Vercel projects: `web-client` (auto-generated) and `app-8-agentic-travel-agent` (which has the `interviewiangreenough.xyz` domain). Deploy to `app-8-agentic-travel-agent` so the custom domain works. The local `.vercel/project.json` in `web-client/` currently points to the wrong project and needs to be relinked.

## Commit conventions
- Make **separate commits** for unrelated tasks — do not bundle unrelated changes into one commit.
