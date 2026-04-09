# Engineering Audit: Voyager

**Date:** 2026-04-09
**Auditor:** CTO role (canonical definition: `~/.claude/audits/engineering.md`)
**Branch:** main
**Head commit:** `c49a7c8` Merge pull request #28 from nullvoidundefined/docs/session-handoff-2026-04-07

---

## Executive Summary

Voyager is a mature solo-developer portfolio project. The core agentic loop, external API safety rails (quota counter, circuit breaker, fail-soft tool returns), testing infrastructure (620+ unit tests, 85% coverage threshold, full E2E mock harness, nightly real-API workflow), and CI/CD gates are all meaningfully engineered. The 2026-04-06 and 2026-04-07 sessions shipped substantial hardening.

Three problems stand out as the most consequential open items today.

**Top 3 priorities:**

1. **B14 (P1): Tile selections do not persist to the trip record.** The core booking loop is broken for real users: selecting a flight, hotel, car, or experience sends a chat message but writes nothing to `trip_flights`, `trip_hotels`, `trip_car_rentals`, or `trip_experiences`. The trip detail page shows "$0 allocated" and "No itinerary items" regardless of what the user selects. This is a P1 functional defect against the product's primary value proposition. It sits in `docs/bugs.md` without a severity tag, which violates the project's own `docs/BUGS.md severity tagging` rule.

2. **ENG-05 (P2): No error tracking (Sentry or equivalent).** A multi-step agentic loop with up to 8 model calls per user message, external SerpApi and Google Places calls, circuit breaker transitions, and Redis interactions has zero structured error aggregation beyond Pino logs. Incidents are diagnosed by searching logs rather than by triaging grouped error events. This is a known gap carried from the 2026-04-06 audit.

3. **e2e-real-apis.yml script name bug (P2): Nightly real-API workflow will always fail.** The workflow calls `pnpm --filter voyager-server run migrate` but the script is named `migrate:up` in `server/package.json`. The `migrate` script does not exist; pnpm will exit non-zero on every nightly run. The real-API smoke against live SerpApi/Anthropic will never execute. Given that SerpApi's 250 search/month quota means quota exhaustion may be the first signal of a broken environment, the nightly smoke is a meaningful safety net that is currently dark.

---

## Operational Basics

| Check                         | Status                           | Notes                                                                                                                             |
| ----------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests run                | YES                              | `pnpm test` runs vitest; CI runs them with coverage.                                                                              |
| CI is green                   | YES                              | `lint-and-test` and `e2e` workflows both required on main. Branch protection enforces this.                                       |
| E2E tests wired and executing | YES (mocked), PARTIAL (real-API) | Mocked E2E runs on every PR via the `e2e` required check. Real-API nightly workflow is present but broken (see below).            |
| Coverage threshold enforced   | YES                              | 85% on branches/functions/lines/statements in `server/vitest.config.ts`.                                                          |
| Error tracking                | NO                               | No Sentry. Pino logs only. ENG-05 is open.                                                                                        |
| Monitoring / health checks    | PARTIAL                          | `/health` and `/health/ready` endpoints exist. Post-deploy health check fires on push to main. No uptime monitoring, no alerting. |
| Rollback plan documented      | NO                               | Railway has one-click rollback in the dashboard but no written runbook. ENG-11 is open.                                           |
| Smoke test in CI              | NO                               | `scripts/smoke-test.sh` exists and `npm run test:smoke` works locally but the script is not wired as a CI step. ENG-09 is open.   |

---

## Architecture and Design

**Strengths:**

- Clean layering: routes -> handlers -> services/repositories is consistently applied. No handler reaches directly into the database; all DB access goes through repositories.
- `AgentOrchestrator` is a well-isolated class with constructor-injectable dependencies (client, tools, system-prompt builder, tool executor, callbacks). This is correctly designed and is the foundation the E2E mock harness rests on.
- `ToolAdapters` injection in `executeTool` (ENG-04 fix) is clean. The adapter seam allows per-tool replacement without global env flags, and both the E2E harness and the unit test suite use it correctly.
- Redis usage is appropriately defensive: both `cache.service.ts` and `serpApiQuota.service.ts` fail open on Redis unavailability. This is the right posture for a portfolio demo.
- The circuit breaker (`CircuitBreaker.ts`) correctly implements closed/half-open/open state with a configurable failure threshold and cooldown. `isRetryable` predicate prevents non-retryable 400 errors from tripping the breaker.

**Concerns:**

- **`activeConversations` exposed in `/health/ready` response (SEC-09, P2).** The count of in-flight agent loops is a timing side-channel. A public health endpoint should not leak concurrency state. `server/src/app.ts:122` returns `{ status, db, cache, activeConversations }` on every `/health/ready` request. Fix: move `activeConversations` behind auth, or remove it from the health response entirely. Already tracked as SEC-09.

- **`dist/` contains stale Amadeus build artifacts.** `server/dist/services/amadeus.service.js` and `server/dist/services/amadeus.service.test.js` are present. The source file no longer exists under `server/src/`; the migration `1771879388560_remove-amadeus-columns.js` cleaned the schema. The `dist/` directory is not committed (it is in `.gitignore`) so this is a local-only issue, but it means a developer running `node server/dist/...` directly would encounter a module that references dead code. More importantly, the Dockerfile copies `server/dist/` into the production image. If `dist/` was not freshly built before `docker build`, the stale file lands in production. The standard mitigation is to run `tsc --clean` or `rm -rf dist` before `tsc` in the build script. Currently the build script (`"build": "tsc && tsc-alias -p tsconfig.json && mkdir -p dist/data && cp src/data/*.json dist/data/"`) does not clean first. Recommend adding `rm -rf dist &&` before `tsc`.

- **In-memory conversation lock (`activeConversations: Set<string>`) does not survive process restart and does not scale beyond one Railway replica.** For a portfolio demo with a single instance this is fine. The operational risk is that a Railway restart during an active agent turn drops the lock without notifying the client. On multi-instance deploy this would allow two agent loops for the same conversation. This is consistent with the current architecture; flag it as a tech-debt note rather than a blocker.

- **`metrics.service.ts` is a log-backed stub.** `LogMetricsService` writes structured log lines. The interface is correctly designed for a future swap to Prometheus/DataDog, but the current implementation provides zero query-time aggregation. Combined with no Sentry (ENG-05), there is no observable error aggregate or cost trend.

---

## Code Quality

- Consistent naming and file organization throughout. Handlers are shallow orchestrators; business logic lives in services and tools. Repository functions use explicit SQL with no ORM.
- `formatZodError` in `executor.ts` produces human-readable validation messages that the agent can act on. This is the correct design for a tool executor where the model must interpret errors.
- Comment quality is high and traceability to audit IDs (ENG-xx, SEC-xx, FIN-xx) is thorough. Future auditors can grep `ENG-04` and find the PR, the migration, and the tests.
- **`pnpm test` from the monorepo root only runs server tests.** `web-client/` has 89+ test files discoverable via `pnpm --filter voyager-web test` but the root `test` script (`"test": "pnpm --filter voyager-server run test"`) does not invoke them. This means "run tests" at the repo level silently skips half the suite. Flagged in the 2026-04-07 handoff as ENG-22-followup; still open.
- **`server/.next/` directory exists in the server package root** (`/Users/iangreenough/Desktop/code/personal/production/voyager/server/.next/trace`). This is a stale Next.js artifact, likely from a time when a frontend was briefly scaffolded inside `server/`. It is almost certainly `.gitignore`d but its presence is confusing and adds to build context when Docker copies `server/`.

---

## Security

The 2026-04-06 security audit (P0 and P1 findings) and its follow-up fixes are shipped. The remaining open issues (SEC-05 through SEC-19) are P2/P3 and are tracked in `ISSUES.md`. This audit confirms them as still open and adds one note:

- **SEC-09 (P2):** `/health/ready` leaks `activeConversations` count. See Architecture section.
- **SEC-05 (P2):** No Postgres RLS. All row-level access control is enforced at the application layer (`WHERE user_id = $1`). This is functional but creates a defense-in-depth gap if a query path is ever missed.
- **SEC-06 (P2):** CSRF is header-presence only (`X-Requested-With`). No synchronizer-token pair.
- **SEC-07 (P2):** `errorHandler` returns `err.message` when `NODE_ENV !== 'production'`. SerpApi error bodies (which may contain parameter details) can leak through.
- **SEC-08 (P2):** Auth rate limiter covers login and register on the same budget.
- **B14 has a security dimension (P1):** The `select_flight`, `select_hotel`, `select_car_rental`, and `select_experience` tool branches in `executor.ts` require a `context` argument containing `tripId` and `userId`. When these are called, the repository functions (`insertTripFlight`, etc.) must verify that `tripId` belongs to `userId`. Confirm this ownership check is enforced in the repository layer before B14 is fixed.

---

## Credential Exposure Scan

**Scan performed 2026-04-09.**

| Surface                                                                                                         | Result                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git history (`git log -p --all -S<pattern>`)                                                                    | No matches for any credential pattern.                                                                                                                                                                                                                                                   |
| Working tree (rg across repo, excluding node_modules)                                                           | No matches.                                                                                                                                                                                                                                                                              |
| Claude Code session JSONLs (`~/.claude/projects/-Users-iangreenough-Desktop-code-personal-production-voyager/`) | 5 JSONL files present. Scan result: 1 match in 1 file (pattern: `sk-ant-api03-`). Match count: 1. The session JSONL is the record of prior Claude Code conversations about this project; any API key pasted in chat or passed on a command line during those sessions would appear here. |
| Shell history (`~/.zsh_history`, `~/.bash_history`)                                                             | No matches for any credential pattern.                                                                                                                                                                                                                                                   |
| Railway config (`~/.railway/config.json`, 13214 bytes)                                                          | No matches for credential patterns.                                                                                                                                                                                                                                                      |
| GitHub CLI config (`~/.config/gh/hosts.yml`, 100 bytes)                                                         | No matches.                                                                                                                                                                                                                                                                              |

**Finding:** One JSONL file for this project contains a string matching the `sk-ant-api03-[A-Za-z0-9_-]{50,}` pattern. The match count is 1, suggesting a single occurrence of an Anthropic API key in session history.

**Required remediation per audit protocol:**

1. Rotate the API key at the Anthropic dashboard (console.anthropic.com) if the key has not been rotated since the session it appeared in.
2. Delete or truncate the affected JSONL to remove the exposure surface.
3. Verify `~/.claude/hooks/secret-scan.sh` is installed and wired in `~/.claude/settings.json` as a `PreToolUse` Bash hook to prevent recurrence.

This is not treated as a full P0 blocker against this audit since the JSONL is a local file not committed to any repository, and the working tree scan is clean. However, rotation is recommended as a precaution.

---

## Database

- Schema design is solid. Migrations are numbered and sequential. The `node-pg-migrate` runner is wired to CI via the `migrate:up` step.
- **`pg` NUMERIC type coercion is globally registered** (`pg.types.setTypeParser` in `pool.ts`) following the B24 fix. This is the correct approach; it prevents `NaN` from propagating into budget calculations.
- Indexes: the schema migrations were not read in full. Spot-check the trips and conversations tables for `user_id` and `trip_id` foreign key indexes. Missing indexes on these high-cardinality columns would cause full-table scans on every session load.
- `deleteExpiredSessions` is defined but not scheduled (SEC-13). Sessions accumulate indefinitely.
- No RLS (SEC-05). Application-layer `WHERE user_id = $1` is the only authorization enforcement.

---

## API Design

- Route structure is clean: `/auth`, `/trips`, `/places`, `/user-preferences`. Consistent REST naming.
- Error responses use `ApiError` with a code and message, returning structured JSON. The `errorHandler` middleware serializes them consistently.
- The chat endpoint (`POST /trips/:id/chat`) streams SSE. The 30-second request timeout in `app.ts` applies to all routes, but SSE connections legitimately run longer than 30 seconds. The `res.setTimeout` call does not appear to be disabled for SSE routes. This means a long agent turn that exceeds 30 seconds would trigger a 408, leaving the client with a partial stream. The `AgentOrchestrator` has its own 120-second wall-clock limit, but the Express timeout fires before that. Recommendation: disable or extend the per-request timeout specifically on the SSE chat route.
- Rate limiting uses Redis store when `REDIS_URL` is set (SEC-04 fix). The `enableOfflineQueue: true` fix (also in SEC-04) prevents the "closed when not connected" crash on boot. Rate limiter correctly uses `E2E_BYPASS_RATE_LIMITS` for test isolation.

---

## Performance

- SerpApi response caching is implemented via Redis (`cacheGet`/`cacheSet` in tool implementations). Cache keys are normalized (sorted params, lowercased strings) via `normalizeCacheKey`. This is correct and important given the 250-search/month quota.
- The monthly quota counter (Redis `INCR` + TTL) is a lightweight and correct approach. Fails open on Redis unavailability.
- The circuit breaker (`serpApiBreaker`) has a 3-failure threshold and 60-second cooldown. This is appropriate for a free-tier external API.
- Token budget per user per day is enforced in Redis (`tokenBudget.service.ts`). Fails open. Correct.
- The `AgentOrchestrator` default of 8 iterations (lowered from 15 per FIN-06) bounds worst-case per-turn Anthropic cost.
- **No connection pooling analysis.** The `pg` pool is configured with default settings. Under load, default pool size (10 connections) may be hit by concurrent agent loops. With `E2E_BYPASS_RATE_LIMITS=1` in CI and 2 parallel workers, pool exhaustion is a latent risk during E2E runs. The `pool.on('error', ...)` handler in `app.ts` logs but does not crash, which is the correct behavior.

---

## Testing

### Strengths

- 620+ server unit tests with 85% branch/function/line/statement coverage, enforced by vitest thresholds.
- Two integration test files covering auth flow and CORS headers with a real Postgres container.
- Full E2E suite (35 user stories, 0 `test.fixme` markers outside the comment in `chat-booking-flow.spec.ts`) wired to CI as a required status check.
- `E2E_MOCK_ANTHROPIC=1` swaps the real Anthropic SDK for a deterministic `MockAnthropicClient`, eliminating token burn and non-determinism from CI.
- `E2E_MOCK_TOOLS=1` swaps SerpApi/Google Places for in-process mock adapters.
- `ToolAdapters` injection enables per-tool mock granularity in unit tests without global env flags.
- `ChatBox.invariants.test.tsx` exists and documents 8 invariants, fulfilling the CLAUDE.md mandate.

### Gaps

- **ENG-07 (P2): No integration test for the chat endpoint.** The SSE path, the conversation lock (409 on concurrent request), the token budget check, and the enrichment node flow have no integration test. The existing integration tests cover auth and CORS only. The chat endpoint is the product's critical path.
- **`src/app.ts` has 0% coverage** (noted in ENG-19 as remaining gap). The Express app bootstrap, health endpoints, destinations endpoint, and middleware ordering are untested below the E2E layer. An integration test bootstrapping the app would cover this.
- **`src/services/enrichment-sources/*` are 8-66% covered** (noted in ENG-19). These are external HTTP wrappers; they need mocked-HTTP tests.
- **Root `pnpm test` misses the web-client suite.** See Code Quality section. This is a CI parity issue: developers who run `pnpm test` locally see a green pass that excludes 89+ frontend tests.
- **Comment in `chat-booking-flow.spec.ts` (line 12) says US-19 and US-23 are `test.fixme`**, but grepping the file shows neither is actually marked `test.fixme`; they appear to be active tests. The comment is stale and should be removed. ENG-17 in ISSUES.md is already RESOLVED.

### Bug Fix Discipline (last 30 days)

100 commits match `fix:` or `fix(` prefix in the last 30 days. Of these, approximately 39 have no test file in the same commit. Many are legitimately not testable (port number change, Prettier config exclusion, Unsplash photo ID replacement, ESLint config update), but a significant number represent production behavior fixes without a reproducing test:

| SHA        | Subject                                                           | Classification                                       |
| ---------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| `437c8234` | fix(UX-04): migrate trip delete to Radix AlertDialog primitive    | UI behavior change, no test                          |
| `bb0ecd7f` | fix(SEC-04): wire rate limiter to Redis store                     | Security config, test added separately at `3729a835` |
| `7ad22496` | fix: add conversation lock to prevent concurrent agent loops      | Critical path fix, no test                           |
| `e6f452c4` | fix: auto-save form data when user sends chat message             | Behavior fix, no test                                |
| `183eb289` | fix: optimistic user messages, prevent text walls, form rendering | Multi-symptom fix, no test                           |
| `9e2eab7d` | fix: render QuickReplyChips inside message bubble                 | UI fix, no test                                      |
| `e62bc046` | fix: persist tool result cards after stream ends                  | Critical streaming fix, no test                      |
| `06080ed0` | fix: refresh trip data after every tool result                    | Data freshness fix, no test                          |

**Finding:** 8+ substantive behavior fixes in the 30-day window have no paired test. This qualifies as a P1 behavioral pattern per the audit rule (3+ unpaired fixes in 30 days is P1). The current `fix-commit-gate` lefthook blocks `fix:` commits without a test file, but many of these predate the hook going blocking (it became blocking on 2026-04-06). The older uncovered fixes remain as latent regression risk.

The recent batch (B24-B31, April 7) is well-disciplined: all 8 fixes in that batch have tests. The pattern has improved but the gap in the historical tail is real.

---

## Dependencies and Supply Chain

- `pnpm audit --prod` returns no known vulnerabilities (confirmed by running the check during this audit).
- `pnpm audit --audit-level high` runs in CI (added by `fix(SEC-02,ENG-06)`). This is the correct gate.
- ENG-06 (Dependabot/Renovate) is still open. No automated dependency update bot is configured. Without it, the clean audit result decays over time without any notification.
- Notable dependency versions: `@anthropic-ai/sdk ^0.81.0`, `express ^5.2.1` (Express 5 beta), `next 15.5.14` (current release series), `zod ^4.3.6`. No immediately concerning outdated packages visible.
- `pnpm.overrides` in root `package.json` pins `path-to-regexp`, `lodash`, and `brace-expansion` to safe versions. These are CVE-driven overrides; correct practice.

---

## Deployment and Infrastructure

- **Dockerfile is multi-stage and correct.** Base stage installs all deps and builds; production stage installs prod-only deps and copies `dist/`. `destinations.json` is explicitly copied (`COPY server/src/data/destinations.json server/dist/data/destinations.json`), addressing the `bea33cc5` incident.
- **ENG-08 (P2): Dockerfile runs as root.** Neither stage sets `USER node`. The `node:22-slim` base image has a `node` user available. This is a one-line fix.
- **`railway.toml` is minimal and correct** (`dockerfilePath = "Dockerfile.server"`). No Nixpacks env vars are set (correct per CLAUDE.md's "Nixpacks conflict" warning).
- **`e2e-real-apis.yml` calls `pnpm --filter voyager-server run migrate` but the script is `migrate:up` (P2 blocker for nightly workflow).** The nightly real-API smoke has never successfully run migrations. Every nightly run exits at the migrate step with `ERR_PNPM_NO_SCRIPT migrate not found`. Fix: change `run migrate` to `run migrate:up`.
- **Post-deploy health check (`post-deploy.yml`) fires 90 seconds after push to main.** The `sleep 90` approach is fragile; a slow Railway deploy will pass the health check before the new container is actually serving traffic. A polling loop with a timeout would be more reliable. The current implementation is adequate for a portfolio project.
- **No `RAILWAY_URL` or `VERCEL_URL` in the `post-deploy.yml` documentation.** The workflow references `${{ vars.RAILWAY_URL }}` and `${{ vars.VERCEL_URL }}` as repository variables. These must be set in GitHub repository settings for the post-deploy check to function. This is documented in CLAUDE.md and the project convention files, but is not verified in the workflow itself (no assertion that the variables are non-empty before the curl step).

---

## Runbook-vs-Code Drift Scan

No `docs/runbooks/` directory exists. The project-specific CLAUDE.md serves as the operational runbook. Comparing it against code:

- **CLAUDE.md says `CORS_ORIGIN` is comma-separated:** `"https://interviewiangreenough.xyz,https://agentic-travel-agent-dmvmh3529-nullvoidundefineds-projects.vercel.app"`. Code in `corsConfig.ts` splits on comma. Aligned.
- **CLAUDE.md says "Stale Railway link: relink from monorepo root."** The `railway.toml` is at the monorepo root. Aligned.
- **CLAUDE.md says Vercel deploy from `web-client/`.** `web-client/vercel.json` exists with `"framework": "nextjs"`. Aligned.
- **CLAUDE.md says "Do NOT set `outputFileTracingRoot` in `next.config.ts`."** `web-client/next.config.ts` does not set it. Aligned.
- **ENG-17 comment in `chat-booking-flow.spec.ts` says US-19 and US-23 are `test.fixme`**, but ENG-17 is RESOLVED in ISSUES.md and neither test is actually marked fixme. The comment is stale documentation. P3, no operational impact.

No P0 or P1 runbook-vs-code drift found.

---

## Workspace Hygiene

Searched for duplicate or near-duplicate Voyager directories across `~/Desktop/code/`, `~/Desktop/`, `~/code/`, and `~/projects/`. The parent `CLAUDE.md` at `/Users/iangreenough/Desktop/code/personal/production/CLAUDE.md` references `voyager` as one of 8 portfolio apps. No other directory with a `package.json` naming `voyager` was found outside the canonical project root.

**Finding:** No duplicate workspace. Workspace is clean.

---

## Tech Debt Register

| ID                     | Description                                                         | Severity | Effort | Risk                                                 |
| ---------------------- | ------------------------------------------------------------------- | -------- | ------ | ---------------------------------------------------- |
| B14                    | Tile selections do not persist to trip record                       | P1       | M      | Core booking loop is broken for real users           |
| ENG-05                 | No Sentry / error tracking                                          | P2       | M      | Incidents diagnosed by log grep only                 |
| ENG-07                 | Chat endpoint has no integration test                               | P2       | M      | Critical path untested below E2E                     |
| ENG-08                 | Dockerfile runs as root                                             | P2       | S      | Container compromise escalates to full host access   |
| ENG-09                 | Smoke test not wired to CI                                          | P2       | S      | Boot-time errors not caught without full E2E         |
| SEC-05                 | No Postgres RLS                                                     | P2       | L      | Defense-in-depth gap on row isolation                |
| SEC-06                 | CSRF header-only, no synchronizer token                             | P2       | M      | CSRF attack surface from non-browser clients         |
| SEC-09                 | `activeConversations` leaked in `/health/ready`                     | P2       | S      | Concurrency side-channel on a public endpoint        |
| SEC-13                 | Session cleanup not scheduled                                       | P2       | S      | Sessions accumulate indefinitely                     |
| ENG-11                 | No rollback runbook                                                 | P3       | S      | Operator must improvise under pressure               |
| ENG-16                 | Local e2e fast lane needs manual setup step                         | P3       | S      | Developer friction, not blocking                     |
| Express timeout on SSE | 30s request timeout fires before 120s agent loop limit              | P2       | S      | Long agent turns produce 408 before completion       |
| `dist/` cleanup        | Build script does not clean before tsc                              | P2       | S      | Stale files from deleted source land in Docker image |
| Root `pnpm test`       | Only runs server; silently skips web-client suite                   | P2       | S      | Developer test run gives false confidence            |
| Comment drift          | `chat-booking-flow.spec.ts` comment says fixme but tests are active | P3       | S      | Misleads future readers                              |

---

## Prioritized Recommendations

Ranked by risk reduction per unit of effort.

| #   | Recommendation                                                                                                                                                                                                                                | Severity | Impact | Effort |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ------ |
| 1   | Fix B14: implement tile selection persistence. Add `select_flight`, `select_hotel`, `select_car_rental`, `select_experience` calls that write to the persistence tables when the user confirms a selection. Write the reproducing test first. | P1       | H      | M      |
| 2   | Fix `e2e-real-apis.yml`: change `run migrate` to `run migrate:up` so the nightly real-API smoke can actually run. One-line fix, one commit.                                                                                                   | P2       | H      | S      |
| 3   | Fix Express request timeout on SSE route: disable or extend the 30-second timeout for the chat endpoint so long agent turns do not produce spurious 408s.                                                                                     | P2       | H      | S      |
| 4   | Add `rm -rf dist &&` before `tsc` in `server/package.json` build script to prevent stale Amadeus artifacts from landing in Docker image.                                                                                                      | P2       | M      | S      |
| 5   | Add `USER node` to `Dockerfile.server` (ENG-08). One line in the production stage.                                                                                                                                                            | P2       | M      | S      |
| 6   | Wire `scripts/smoke-test.sh` as a CI step in `ci.yml` after the unit tests (ENG-09). Prevents boot-time regressions from going undetected until the E2E suite runs.                                                                           | P2       | M      | S      |
| 7   | Add severity and effort tags to all open bugs in `docs/bugs.md` (B2, B10-B23). Project convention requires this; currently none of the 15 open bugs are tagged.                                                                               | P2       | M      | S      |
| 8   | Add Sentry to server and web-client (ENG-05). Medium effort but high ongoing operational value.                                                                                                                                               | P2       | H      | M      |
| 9   | Add integration test for the chat endpoint covering: auth required, 409 lock conflict, token budget exceeded (ENG-07).                                                                                                                        | P2       | H      | M      |
| 10  | Alias root `pnpm test` to run both server and web-client suites. Single package.json script change.                                                                                                                                           | P2       | M      | S      |
| 11  | Remove the stale `test.fixme` comment from `chat-booking-flow.spec.ts` line 12 (ENG-17 is RESOLVED).                                                                                                                                          | P3       | L      | S      |
| 12  | Schedule `deleteExpiredSessions` via a cron or a background interval (SEC-13).                                                                                                                                                                | P2       | M      | S      |
| 13  | Move `activeConversations` out of the public `/health/ready` response (SEC-09).                                                                                                                                                               | P2       | M      | S      |

---

## Appendix: Bug Fix Discipline Details

The following commits in the last 30 days match the `fix:` / `fix(` prefix and contain no test file change. The list below is filtered to substantive behavior fixes only (excluding config-only, tooling-only, and mislabeled commits):

| SHA        | Subject                                                                 |
| ---------- | ----------------------------------------------------------------------- |
| `7ad22496` | fix: add conversation lock to prevent concurrent agent loops            |
| `e6f452c4` | fix: auto-save form data when user sends chat message                   |
| `183eb289` | fix: optimistic user messages, prevent text walls, form rendering       |
| `9e2eab7d` | fix: render QuickReplyChips inside message bubble, not standalone       |
| `e62bc046` | fix: persist tool result cards after stream ends, stop text duplication |
| `1eb12aca` | fix: make card selections directive so agent locks in choices           |
| `6ecef94e` | fix: eliminate page flicker between /trips/new and trip detail          |
| `06080ed0` | fix: refresh trip data after every tool result and booking confirmation |
| `2b9209e5` | fix: persist submitted form data in chat history                        |
| `437c8234` | fix(UX-04): migrate trip delete to Radix AlertDialog primitive          |
| `bb0ecd7f` | fix(SEC-04): wire rate limiter to Redis store when REDIS_URL is set     |

These 11 commits represent pre-hook-blocking era work. The `fix-commit-gate` lefthook now prevents new occurrences. No action required on the historical commits; the risk is regression coverage, not current process violation.
