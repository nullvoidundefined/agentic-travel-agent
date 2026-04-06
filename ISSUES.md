# Voyager, Open Issues

Rolling log of open issues, P2 and P3 severity. P0 and P1 items live in the current triage file under `docs/audits/`. This file is append-only; never overwritten.

Each entry includes severity, effort, category, and source (which audit surfaced it).

---

## 2026-04-06 audit run (P2 and P3 findings)

### Engineering (tech debt)

### [ENG-05] No Sentry / error tracking integrated

- **Source:** engineering §Operational Basics
- **Severity:** P2 · **Effort:** M · **Category:** observability
- **Notes:** logs-plus-post-deploy-check partially mitigates. Adding Sentry to both server and web-client is a significant observability win for an agentic product that has many failure modes.

### [ENG-06] No `pnpm audit` in CI, no Dependabot / Renovate

- **Source:** engineering §Dependencies
- **Severity:** P2 · **Effort:** L · **Category:** security / tech-debt
- **Notes:** A repo with ~40 dependencies and no automated dependency updates will drift into CVEs within 6-12 months. Add `pnpm audit --prod` to CI and wire up Dependabot via `.github/dependabot.yml`.

### [ENG-07] Chat endpoint has no integration test

- **Source:** engineering §Testing
- **Severity:** P2 · **Effort:** M · **Category:** testing
- **Notes:** SSE flow, auth, rate limit, 409 conflict under lock. The critical-path endpoint has only unit tests.

### [ENG-08] Dockerfile runs as root

- **Source:** engineering §Deployment, security §Infrastructure
- **Severity:** P2 · **Effort:** S · **Category:** security
- **Notes:** Use `USER node` (already present in `node:22-slim`). Quick hardening win.

### [ENG-09] Smoke test script not wired to CI

- **Source:** engineering §Operational Basics
- **Severity:** P2 · **Effort:** S · **Category:** testing
- **Notes:** `scripts/smoke-test.sh` is referenced from `package.json` but may not exist. Verify and wire into CI.

### [ENG-18] Restore server vitest coverage threshold to 80% by writing the missing tests

- **Source:** PR-G follow-up (2026-04-06). PR-G lowered the server vitest coverage threshold from 80% to 75% so the lint-and-test workflow could go green after PR-C correctly removed `**/rateLimiter.ts` from the coverage exclusion. The 75% number reflects current reality, not the goal.
- **Severity:** P2 · **Effort:** L · **Category:** testing / quality
- **Notes:** Files currently below 70% branch coverage (per the run that exposed the gap):
  - `src/app.ts` 0% (the Express app composition; no tests at all)
  - `src/index.ts` 0% (server entrypoint)
  - `src/routes/places.ts` 0%
  - `src/routes/trips.ts` 0%
  - `src/routes/index.ts` 0%
  - `src/utils/logs/logger.ts` 0%
  - `src/services/agent.service.ts` 45.83%
  - `src/prompts/trip-context.ts` 10%
  - `src/middleware/requestLogger.ts` 50%
  - `src/tools/flights.tool.ts` 60%
  - `src/tools/hotels.tool.ts` 59.25%
  - `src/tools/executor.ts` 68.96%
  - `src/handlers/chat/chat.helpers.ts` 65.67%
  - `src/handlers/trips/trips.ts` 67.64%

  Path: write missing-tests in priority order (route handlers and trip-context first since they have the highest blast radius), bump the threshold back to 80, then keep going to 85 once the immediate gap closes. Each increment is its own PR. Estimated effort: 4-6 hours of focused test writing across 6-10 source files. The ENG-15 retrospective output at `docs/audits/2026-04-06-test-suite-evaluation.md` already lists the highest-leverage targets, so use it as the work plan.

  Related: ENG-15 (test suite evaluation, completed) recommends fixture-replay tests for the LLM consumer surface. Those tests would also push branch coverage on agent.service.ts and AgentOrchestrator.ts.

### [ENG-17] Trip-with-selections fixture for the last 3 test.fixme markers

- **Source:** PR-E follow-up (2026-04-06). Renamed from "multi-turn MockAnthropic state machine" after PR-E discovered the original analysis was wrong. US-19, US-25, and US-28 unblocked WITHOUT a mock state machine because (a) the chat handler post-loop server-injects `travel_plan_form` nodes when the trip is in COLLECT_DETAILS phase, (b) `ChatBox.handleSend` intercepts the literal "Confirm booking" message and opens the booking modal directly (no agent round-trip), and (c) US-28 only needs trip status `saved` which is settable via PUT /trips/:id. Three fixmes remain.
- **Severity:** P2 · **Effort:** M · **Category:** testing / e2e
- **Notes:** Remaining fixmes and what each actually needs:
  1. **US-23 select and confirm a tile card** (e2e/chat-booking-flow.spec.ts): the test needs to click a flight tile, click the SelectableCardGroup "Confirm Selection" button, and verify the trip record now has a selected_flight value. Doable with the current mock as long as the backend `select_flight` tool path works end-to-end. The blocker is that the test must read the trip record after the click to verify persistence, which means it needs to make a GET /trips/:id call from the test runner. Achievable, just slightly more involved than the other unblocks.
  2. **US-26 review itemized breakdown** (e2e/checkout.spec.ts): the BookingConfirmation modal renders flights, hotels, car_rentals, experiences arrays from the trip record. To assert line items appear, the trip must have these populated BEFORE the modal opens. Either via the API (PUT /trips/:id with the selection fields, but the data shape is non-trivial: each entry is a full Flight / Hotel / etc. object with airline, price, currency, etc.) or via the chat tile selection flow (depends on US-23 working).
  3. **US-27 confirm and book the trip** (e2e/checkout.spec.ts): depends on US-26 setup. Once the modal renders with line items, clicking "Save itinerary" calls handleConfirmBooking which PUTs status=saved. The assertion is "trip status becomes saved" which is testable, but the modal needs items to be visible first.

  Suggested approach: build a `seedTripWithSelections(user, options)` helper in `e2e/fixtures/test-trips.ts` that creates a trip and PUTs a hand-crafted selection payload. The payload structure can be derived from the existing mock SerpApi shapes (the flights/hotels arrays the agent loop currently produces). Estimated effort: 1 to 2 hours including the helper, the three unblocks, and tests. Once that lands, all 10 of the original fixme markers will be active tests.

### [ENG-16] Local e2e-fast fast lane needs CI parity before it can be promoted to blocking

- **Source:** PR-A queue cleanup (2026-04-06). Promoted to blocking too eagerly; reverted; partially fixed in PR-F; fully fixed in PR-I.
- **Severity:** P2 · **Effort:** M · **Category:** testing / DX
- **Status:** RESOLVED in PR-I (2026-04-07).
  - New `scripts/e2e-local-db.sh` provisions a local Postgres test database (idempotent), runs migrations, and emits a `DATABASE_URL` export statement. Invoked opt-in via `E2E_PROVISION_LOCAL_DB=1` on the first run, then skipped on subsequent runs because the DB already exists.
  - `scripts/e2e-precheck.sh` extended to run the DB provisioner when asked and to report the process holding port 3001 (if any) so Playwright's webServer spawn failure mode no longer silently collides with a stale dev server.
  - `playwright.config.ts` now prefers `DATABASE_URL_E2E_LOCAL` over the inherited `DATABASE_URL` when set. Developers can point the fast lane at the local test DB without touching `server/.env`.
  - Together: local fast lane stays fast (single-digit-ms DB latency), the spawn failure mode is visible, and the `e2e-fast` hook is suitable for blocking mode on dev machines that have run the one-time `E2E_PROVISION_LOCAL_DB=1 ./scripts/e2e-precheck.sh`.
  - The hook is NOT re-promoted to blocking in this PR because that requires user opt-in (the one-time provisioning step). The lefthook comment now points developers at the provisioning command; once they run it, they can flip the hook to blocking in their own workflow.

### [ENG-15] Evaluate test suite for bloat, thinness, AND confidence theater

- **Source:** Plan B / option B follow-up (2026-04-06), reinforced by the Doppelscript Haiku code-fence incident the same day
- **Severity:** P2 · **Effort:** M · **Category:** testing / quality
- **Notes:** Run a research subagent (after option B merges so the CI baseline is green) that produces `docs/audits/YYYY-MM-DD-test-suite-evaluation.md`. Goal: smallest set of tests that catches the bugs that matter, with zero confidence theater. Three failure modes to evaluate: bloat (redundant), thinness (gaps), confidence theater (passing tests that wouldn't catch real bugs).

  **Bloat signals:** redundant assertions, coverage delta of zero when a test is removed, test:source LoC ratio outliers, runtime per assertion, tests that have never failed in CI history.

  **Thinness signals:** files with no tests, branch coverage gaps, fix commits without paired tests (cross-ref the fix-commit-gate violations from the 2026-04-06 retrospective: 35 of 51 fix commits violate test-first), user stories without real E2E coverage (the 10 current test.fixme markers are hidden gaps).

  **Confidence theater signals (per the no-confidence-theater rule in `~/.claude/CLAUDE.md`):**
  1. Self-mock: `vi.mock('./foo')` inside `foo.test.ts`
  2. Mocked dependency that IS the thing being tested (parser tested with pre-parsed input)
  3. Mock-call assertions without behavior assertions (`toHaveBeenCalled` only)
  4. Snapshot-only tests with no behavioral assertion
  5. Mocking the integration boundary the test claims to cross (repository tests that mock the db pool)
  6. Tautological assertions (assertion guaranteed by setup)
  7. Loose-shape only assertions (`toBeDefined`, `toBeTruthy`, "no throw")
  8. Skipped tests with no comment or triage reference
  9. Always-failing tests that linger
  10. LLM-consumer tests that hand-mock the model response shape instead of using a real captured fixture (the Doppelscript anchor incident: a Haiku markdown code-fence bug shipped because tests mocked the JSON the parser was supposed to consume; only a live calibration run caught it)

  Deliverable sections: per-package inventory (server, web-client, e2e), top 10 bloat candidates, top 10 thinness gaps, top 10 confidence theater violations with file:line evidence, top 10 untested files with addition candidates, never-failed-in-CI list, coverage map by user story / audit ID / fix commit, concrete add/delete/rewrite recommendations.

  **Deletion threshold:** redundant AND source is stable AND removing it does not drop branch coverage. Three signals before touching anything.

  **Confidence-theater rewrite threshold:** any test that fails the "if I delete the implementation and throw, would this test fail?" check must be rewritten to assert behavior, not interactions. LLM-consumer tests must use a real captured fixture, not a hand-mock.

### [ENG-14] E2E config has no fail-fast smoke check; misconfigurations burn CI time

- **Source:** Plan B / option B follow-up (2026-04-06 incident)
- **Severity:** P2 · **Effort:** S · **Category:** testing / CI / DX
- **Notes:** A 15-minute CI run failed because `CORS_ORIGIN` defaulted to the legacy `http://localhost:5173` (Vite) while Next.js dev runs on `:3000`. Every browser request from the test runner returned `net::ERR_FAILED` and Playwright dutifully retried each of 35 specs three times before reporting failure. The actual problem was a single env var. The lesson: any precondition that, if wrong, would invalidate every test, must be checked BEFORE Playwright spins up. Concrete fix: add a `scripts/e2e-smoke.sh` (or extend `e2e-precheck.sh`) that runs after the webServer is up and BEFORE the test step, hitting `GET /health` and `OPTIONS /auth/login` from `Origin: http://localhost:3000`, and exits non-zero with a clear message if either the server is down OR CORS is misconfigured. Wire it as a workflow step between `playwright install` and `pnpm test:e2e`. Same principle for any future "every test depends on X being true" precondition: assert it explicitly, fail fast, do not let Playwright discover it via 35 consecutive timeouts. Related class: any "legacy default" in a config file (Vite port, old project name, deprecated env var name) is a landmine; add a startup-time validation that flags suspicious defaults when `NODE_ENV=test` or `CI=true`.

### [ENG-13] E2E suite runtime is slower than it should be

- **Source:** Plan B / option B follow-up (2026-04-06)
- **Severity:** P2 · **Effort:** M · **Category:** testing / CI
- **Notes:** Voyager has ~42 Playwright tests with all externals mocked (SerpApi, Google Places, Anthropic via `MockAnthropicClient`). A healthy run at this size and config should land around 6 to 8 minutes; observed CI runs are sitting at 11+ minutes. Two concrete fixes: (1) bump `workers` from 1 to 2 or 4 in `playwright.config.ts` with per-worker test database isolation so the seedUser fixture does not collide. About 2x speedup. (2) Investigate retry frequency. With `retries: 2` a single flaky spec costs 3x its base time. If 10 percent of specs retry, that adds roughly 30 percent wall time. Goal: zero retries on a green run. Once the suite is below 5 minutes the `e2e-fast` lefthook hook can be promoted from warning to blocking.

### [ENG-10] Partial tool-call progress visibility lost at 15-call limit

- **Source:** engineering §AgentOrchestrator
- **Severity:** P3 · **Effort:** M · **Category:** observability
- **Notes:** When the tool-call limit is hit mid-batch, the `toolCallsUsed` and `nodes` arrays lose partial progress visibility. Preserve them in the orchestrator result.

### [ENG-11] No rollback runbook in `docs/`

- **Source:** engineering §Operational Basics
- **Severity:** P3 · **Effort:** S · **Category:** documentation
- **Notes:** Railway has built-in rollback but the procedure is not written down.

### [ENG-12] Package names still say `agentic-travel-agent*` after rename to Voyager

- **Source:** engineering §Naming drift
- **Severity:** P3 · **Effort:** M · **Category:** branding / tech-debt
- **Notes:** Rename the server, web, and shared-types packages to `voyager-*` as one atomic refactor.
- **Status: closed** by the mechanical rename across 39 files plus lockfile regeneration on the `fix/audit-2026-04-06-p0p1` branch. The Vercel project slug and the `interviewiangreenough.xyz` deploy URL still reference the old name in `CLAUDE.md`; those are infra-level identifiers external to the codebase and are tracked as a separate infra cleanup.

---

### Security (hardening)

### [SEC-05] Postgres RLS policies missing

- **Source:** security §Authorization
- **Severity:** P2 · **Effort:** L · **Category:** security
- **Notes:** CLAUDE.md promises RLS but none is configured. Add RLS policies on all user-owned tables (trips, conversations, user_preferences).

### [SEC-06] CSRF uses header-presence check, not synchronizer-token pair

- **Source:** security §CSRF
- **Severity:** P2 · **Effort:** M · **Category:** security
- **Notes:** Upgrade to a synchronizer-token cookie pair for stronger CSRF protection.

### [SEC-07] `err.message` returned in non-production can leak SerpApi error bodies

- **Source:** security §Secrets Management
- **Severity:** P2 · **Effort:** S · **Category:** security
- **Notes:** `errorHandler` returns `err.message` when `NODE_ENV !== 'production'`. Log full, respond scrubbed always.

### [SEC-08] Auth rate limiter is single (login + register + reset)

- **Source:** security §API Security
- **Severity:** P2 · **Effort:** S · **Category:** security
- **Notes:** Separate into `loginLimiter` and `registerLimiter` with different budgets.

### [SEC-09] `activeConversations` exposed in `/health/ready` payload

- **Source:** security §API Security
- **Severity:** P2 · **Effort:** S · **Category:** security
- **Notes:** Don't leak active user IDs in a public health endpoint.

### [SEC-10] Password complexity weak

- **Source:** security §P2
- **Severity:** P2 · **Effort:** S · **Category:** security
- **Notes:** Reject top-1000 breached passwords. Require >=12 chars OR mixed classes.

### [SEC-11] Per-account failed-login backoff not enforced

- **Source:** security §P2
- **Severity:** P2 · **Effort:** M · **Category:** security
- **Notes:** After N failed logins for the same account, introduce exponential backoff independent of IP rate limiting.

### [SEC-12] `requestLogger` may log `req.body`

- **Source:** security §Data Protection
- **Severity:** P2 · **Effort:** S · **Category:** privacy
- **Notes:** Verify the request logger does not record `req.body` at any log level.

### [SEC-13] `deleteExpiredSessions` not scheduled

- **Source:** security §Data Protection
- **Severity:** P2 · **Effort:** S · **Category:** security
- **Notes:** Sessions never expire without a scheduled cleanup job.

### [SEC-14] Tool input schemas too permissive

- **Source:** security §Input Validation §IV3
- **Severity:** P2 · **Effort:** M · **Category:** security
- **Notes:** Tighten tool input schemas to a restrictive character class. Cross-ref SEC-03 (P1).

### [SEC-15] `updateTrip` body not Zod-parsed

- **Source:** security §IV4
- **Severity:** P2 · **Effort:** S · **Category:** security
- **Notes:** Use `updateTripSchema.partial()` on the body.

### [SEC-16] Strip system-prompt-like substrings from tool output before return

- **Source:** security §L2
- **Severity:** P2 · **Effort:** M · **Category:** security
- **Notes:** Defense in depth against prompt-injection exfiltration.

### [SEC-17] Remaining moderate CVEs plus CI audit gate

- **Source:** security §D5-D7
- **Severity:** P2 · **Effort:** S · **Category:** security
- **Notes:** Cross-ref ENG-06.

### [SEC-18] Session rotation hooks for password / email change

- **Source:** security §P3
- **Severity:** P3 · **Effort:** S · **Category:** security
- **Notes:** Rotate session on password / email change when those endpoints ship.

### [SEC-19] Session TTL and refresh semantics not verified

- **Source:** security §P3
- **Severity:** P3 · **Effort:** S · **Category:** security

### [SEC-20] Circuit breaker uses substring error classification

- **Source:** security §P3
- **Severity:** P3 · **Effort:** S · **Category:** reliability
- **Notes:** Replace with structured error codes.

### [SEC-21] `NEXT_PUBLIC_GOOGLE_MAPS_KEY` may be shared with server key

- **Source:** security §Secrets
- **Severity:** P3 · **Effort:** S · **Category:** security
- **Notes:** Verify referrer-restricted and separate from server-side Places key. If shared, split and rotate.

### [SEC-22] Dockerfile HEALTHCHECK directive missing

- **Source:** security §I2
- **Severity:** P3 · **Effort:** S · **Category:** infra
- **Notes:** Railway has its own probe; useful for other runtimes.

### [SEC-23] Helmet CSP may break SSE

- **Source:** security §I3
- **Severity:** P3 · **Effort:** S · **Category:** security
- **Notes:** Verify CSP does not block the SSE chat endpoint in production.

### [SEC-24] HSTS preload submission for production domain

- **Source:** security §I4
- **Severity:** P3 · **Effort:** S · **Category:** security

### [SEC-25] `railway.toml` healthcheck path and restart policy

- **Source:** security §I5
- **Severity:** P3 · **Effort:** S · **Category:** infra

---

### UX (polish)

### [UX-09] Loading state inconsistency across routes

- **Source:** ux §Feedback & State Communication
- **Severity:** P2 · **Effort:** S · **Category:** ux
- **Notes:** `trips/new` has spinner + message; `trips/[id]` has plain "Loading trip..."; `trips` has plain "Loading trips...". Normalize.

### [UX-10] No client-side welcome coachmark on first trip detail view

- **Source:** ux §Onboarding
- **Severity:** P2 · **Effort:** M · **Category:** ux

### [UX-11] Tool-call progress nodes do not summarize what the agent found

- **Source:** ux §Feedback
- **Severity:** P2 · **Effort:** M · **Category:** ux
- **Notes:** Each `tool_progress` node should render a collapsible summary on completion ("Searched flights DEN to SFO Apr 15-20, found 42 options, picked 3 under $450").

### [UX-12] BookingConfirmation modal has 2.2s hardcoded animation without `prefers-reduced-motion` check

- **Source:** ux §Accessibility
- **Severity:** P2 · **Effort:** S · **Category:** a11y
- **Notes:** Cross-ref DES-03. Users with vestibular disorders forced through the animation.

### [UX-13] DOM-scraping auto-save in ChatBox

- **Source:** ux §Forms & Input
- **Severity:** P2 · **Effort:** M · **Category:** tech-debt
- **Notes:** `ChatBox.tsx:91-117` uses `document.getElementById()` to scrape form values on send. Replace with controlled form state lifted to ChatBox.

### [UX-14] Booking success state auto-dismisses after 1.5s

- **Source:** ux §Feedback
- **Severity:** P2 · **Effort:** S · **Category:** ux
- **Notes:** Let the user dismiss manually. 1.5s is too fast to savor the moment.

### [UX-15] 404 vs 500 not distinguished on trip detail error

- **Source:** ux §Error Recovery
- **Severity:** P2 · **Effort:** S · **Category:** ux

### [UX-16] PreferencesWizard does not explain "why we ask" before personal questions

- **Source:** ux §Critical Path
- **Severity:** P2 · **Effort:** S · **Category:** ux

### [UX-17] SelectableCardGroup selection is reversible only via chat

- **Source:** ux §Destructive Actions, §Error Recovery
- **Severity:** P2 · **Effort:** M · **Category:** ux
- **Notes:** Add an "unselect" affordance.

### [UX-18] Verify US-4 (destination detail page) exists

- **Source:** ux §US Coverage
- **Severity:** Verify-first · **Effort:** S · **Category:** ux
- **Notes:** Not confirmed during audit. Blocks US-5 if missing.

### [UX-19] Verify US-5 pre-fill from destination page to `/trips/new`

- **Source:** ux §US Coverage
- **Severity:** P2 · **Effort:** S · **Category:** ux
- **Notes:** `trips/new/page.tsx` does not accept a query param. Story is not implemented as written.

### [UX-20] Wizard overlay click closes without confirming unsaved state

- **Source:** ux §Forms & Input
- **Severity:** P3 · **Effort:** S · **Category:** ux

### [UX-21] Unify "Booked" vs "Saved" terminology

- **Source:** ux §Consistency
- **Severity:** P3 · **Effort:** S · **Category:** ux
- **Notes:** DB status is `saved`, UI label is "Booked". Pick one.

---

### Design (polish)

### [DES-05] Type scale drift in extended tokens (beyond the P1 core)

- **Source:** design §Typography
- **Severity:** P2 · **Effort:** M · **Category:** design

### [DES-06] Component library structure (`components/ui/`) not established

- **Source:** design §Design System Maturity
- **Severity:** P2 · **Effort:** L · **Category:** design
- **Notes:** Cross-ref DES-04 (P1).

### [DES-07] Empty state visuals inconsistent

- **Source:** design §Polish & Craft
- **Severity:** P2 · **Effort:** M · **Category:** design

### [DES-08] Skeleton screens missing on several routes

- **Source:** design §Polish & Craft
- **Severity:** P2 · **Effort:** M · **Category:** design

### [DES-09] Focus states visible on some interactive elements and not others

- **Source:** design §Polish & Craft
- **Severity:** P2 · **Effort:** S · **Category:** a11y

### [DES-10] Alt text strategy inconsistent (decorative vs meaningful)

- **Source:** design §Hero & Imagery
- **Severity:** P3 · **Effort:** M · **Category:** a11y

---

### Marketing (polish)

### [MKT-09] Onboarding does not recurrently explain the product

- **Source:** marketing §Onboarding
- **Severity:** P2 · **Effort:** M · **Category:** marketing

### [MKT-10] No referral or retention loop

- **Source:** marketing §Growth Loops & Retention
- **Severity:** P2 · **Effort:** L · **Category:** marketing

### [MKT-11] No "save a trip to email" or similar re-engagement mechanic

- **Source:** marketing §Growth Loops
- **Severity:** P2 · **Effort:** M · **Category:** marketing

### [MKT-12] Destination page SEO opportunities not exploited

- **Source:** marketing §SEO
- **Severity:** P2 · **Effort:** M · **Category:** marketing

### [MKT-13] FAQ does not lead with the most common question

- **Source:** marketing §CTAs & Microcopy
- **Severity:** P3 · **Effort:** S · **Category:** marketing

### [MKT-14] MockChatBox demo caption says Barcelona but shows Monterey

- **Source:** marketing §Top copy rewrites
- **Severity:** P3 · **Effort:** S · **Category:** marketing

---

### Financial (observability)

### [FIN-08] Amadeus cleanup (separate from ENG-03 schema migration)

- **Source:** financial §Amadeus
- **Severity:** P2 · **Effort:** M · **Category:** tech-debt
- **Notes:** Verify no personal Amadeus dev account is sitting active with a stored credit card from early prototyping.

### [FIN-09] Railway, Vercel, Neon plans and MTD spend not documented

- **Source:** financial §Unaudited Services
- **Severity:** P2 · **Effort:** S · **Category:** financial
- **Notes:** Create `docs/BILLING.md` documenting current plan and monthly cost per service.

### [FIN-10] Anthropic "no training on API data" setting not verified

- **Source:** financial §Compliance
- **Severity:** P2 · **Effort:** S · **Category:** privacy / financial

### [FIN-11] `/health/cost` admin endpoint for MTD spend per provider

- **Source:** financial §P3 rec 12
- **Severity:** P3 · **Effort:** M · **Category:** observability
- **Notes:** Depends on FIN-04 (P1) being landed first.

---

### Legal (backlog)

### [LEG-13] `ATTRIBUTIONS.md` for images, fonts, icons

- **Source:** legal §Copyright
- **Severity:** P2 · **Effort:** S · **Category:** legal

### [LEG-14] License scan in CI

- **Source:** legal §Open Source License Compliance
- **Severity:** P2 · **Effort:** M · **Category:** legal / security
- **Notes:** Run `pnpm licenses list` with an allowlist. Fail CI on GPL/AGPL/SSPL packages in production deps.

### [LEG-15] Internal RoPA (GDPR Art. 30)

- **Source:** legal §Missing Documents
- **Severity:** P2 · **Effort:** M · **Category:** legal
- **Notes:** Not public, but required.

### [LEG-16] `/accessibility` statement

- **Source:** legal §Accessibility Compliance
- **Severity:** P2 · **Effort:** S · **Category:** legal / a11y
- **Notes:** EAA requirement.

### [LEG-17] Sub-processors list page

- **Source:** legal §Data Processing Agreements
- **Severity:** P2 · **Effort:** S · **Category:** legal

### [LEG-18] `security.txt` and responsible disclosure policy

- **Source:** legal §Post-launch
- **Severity:** P3 · **Effort:** S · **Category:** security / legal

### [LEG-19] Quarterly review of FTC guidance on AI deceptive practices

- **Source:** legal §Post-launch
- **Severity:** P3 · **Effort:** ongoing · **Category:** legal

---

## How to use this file

- New audit runs append a new `## YYYY-MM-DD audit run` section at the top.
- P0 and P1 items go to the current triage file under `docs/audits/`, not here.
- Closed items are not removed; append a `**Status: closed in commit <sha>**` line to the entry.
- Deduplicate across audits by cross-referencing IDs (e.g., `cross-ref LEG-02`).
