# Voyager

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

- **Monorepo:** pnpm workspaces with `server/` and `web-client/` packages
- **Frontend:** Next.js 15 on Vercel
- **API:** Express 5 + TypeScript on Railway (Docker)
- **Database:** PostgreSQL on Neon
- **Cache:** Redis on Railway (ioredis)
- **External APIs:** SerpApi (Google Flights + Hotels, 250 searches/month free tier), Google Places API
- **LLM:** Anthropic Claude API (tool use + streaming)

## Critical implementation note

The agent loop runs synchronously on the API server. The agent needs immediate results to reason. Cache SerpApi responses aggressively — 250 searches/month on free tier.

## Frontend conventions

- Use **TanStack Query** (React Query) for all server state — data fetching, caching, mutations, and optimistic updates. No raw useEffect + fetch patterns.
- Use **Toast** component for API/server errors — never show raw error messages or stack traces inline. Keep inline `{error}` only for form validation messages.

## Deployment

### Vercel (frontend)

```bash
cd web-client && npx vercel --prod
```

- Vercel project `agentic-travel-agent`, domain `interviewiangreenough.xyz`
- `.vercel/` link lives in `web-client/` — always deploy from there
- `web-client/vercel.json` sets `"framework": "nextjs"`
- Do NOT set `outputFileTracingRoot` in `next.config.ts` (causes Vercel path doubling error)

### Railway (server)

```bash
railway up --detach
```

- Railway CLI is linked to the monorepo root, where `Dockerfile.server` lives
- `railway.toml` sets `dockerfilePath = "Dockerfile.server"`
- Railway dashboard Build → Dockerfile Path must be `Dockerfile.server`
- `CORS_ORIGIN` env var is comma-separated: `https://interviewiangreenough.xyz,https://agentic-travel-agent-dmvmh3529-nullvoidundefineds-projects.vercel.app`

### Deploy pitfalls

- **Wrong directory:** Railway must run from the monorepo root, not `server/`. Vercel must run from `web-client/`, not the root.
- **Nixpacks conflict:** Never set `NIXPACKS_ROOT_DIR` or `NIXPACKS_CONFIG_FILE` env vars — they override the Dockerfile.
- **Stale Railway link:** If build logs show the wrong directory, relink: `railway link -p d05e2e2b-d70f-4ea6-ae2c-4e0f61a928b4 -s 97a57f4c-65d1-403c-80cf-8c0b742af04f -e production` from the monorepo root.

## Bug fix process — test first, not optimism

When fixing any breaking issue, follow this exact process:

1. **Write a test that reproduces the failure.** Create the exact conditions causing the bug. Run the test. Confirm it **FAILS**.
2. **Fix the code.** Minimal change addressing the root cause.
3. **Run the test again.** Confirm it **PASSES**.
4. **Run the full verification chain:** `pnpm format:check && pnpm lint && pnpm test && pnpm build`
5. **Only then commit and deploy.**

Never claim something is fixed without a failing-then-passing test. Never deploy to "see if it works." Every bug fix commit must contain both the test and the fix.

## Pre-commit / pre-push verification

Lefthook hooks enforce `format:check`, `lint`, and `build` on every commit and push. If hooks aren't blocking bad code, check:

- `git config --local core.hooksPath` — must not point to a stale directory
- Run `npx lefthook install` to reinstall hooks if needed

## Commit conventions

- Make **separate commits** for unrelated tasks — do not bundle unrelated changes into one commit.

## Shared convention files

Read the relevant file in `.claude/bottomlessmargaritas/` **before writing code** in that layer:

- **Backend:** `.claude/bottomlessmargaritas/CLAUDE-BACKEND.md`
- **Frontend:** `.claude/bottomlessmargaritas/CLAUDE-FRONTEND.md`
- **Database:** `.claude/bottomlessmargaritas/CLAUDE-DATABASE.md`
- **Styling:** `.claude/bottomlessmargaritas/CLAUDE-STYLING.md`
- **Deployment:** `.claude/bottomlessmargaritas/CLOUD-DEPLOYMENT.md`
