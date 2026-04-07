# Voyager Test Suite Evaluation

**Date:** 2026-04-06
**Scope:** server unit, server integration, web-client component, canonical e2e/, legacy web-client/e2e
**Source retrospective:** docs/audits/2026-04-06-process-retrospective.md
**Operating root:** /Users/iangreenough/Desktop/code/personal/production/voyager (main branch, not a worktree)

---

## 1. Inventory

| Workspace                                                           | Test files | Test cases | Test LoC | Source LoC | Test:source ratio | Notes                                                                                                           |
| ------------------------------------------------------------------- | ---------: | ---------: | -------: | ---------: | ----------------: | --------------------------------------------------------------------------------------------------------------- |
| server unit (`server/src/**/*.test.ts` excluding `__integration__`) |         47 |        384 |    6,991 |      8,434 |              0.83 | High count, high LoC, deeply mock-heavy.                                                                        |
| server integration (`server/src/__integration__/*.test.ts`)         |          2 |         11 |      173 |      (n/a) |               n/a | Real Express + real DB; auth + cors only.                                                                       |
| web-client component (`web-client/src/**/*.test.tsx`)               |          3 |         18 |      236 |     11,215 |              0.02 | Three components only: Toast, AuthGuard, SelectableCardGroup. The other 49 components have zero coverage.       |
| canonical e2e (`e2e/*.spec.ts`)                                     |          2 |          9 |      105 |        n/a |               n/a | auth + navigation only. No chat, trips, preferences, checkout.                                                  |
| legacy e2e (`web-client/e2e/*.spec.ts`)                             |          9 |         37 |      590 |        n/a |               n/a | Slated for deletion per the brief but still on disk; runs against a separate `web-client/playwright.config.ts`. |

**Skipped / fixme tests:** 0 across all suites. `grep '\.(skip|fixme|todo)\(' --include='*.{ts,tsx}'` returns no matches in `e2e/`, `web-client/e2e/`, `server/src/`, or `web-client/src/`. The brief mentioned 10 `test.fixme` markers in chat-flow / checkout / preferences; those markers do not exist on `main` (they may live in a worktree or were removed). Reporting the disk truth on main: zero markers.

**Files referenced in the brief that are not on main:** `server/src/services/mock-anthropic-client/mock-anthropic-client.test.ts` exists only under `.claude/worktrees/queue-cleanup-2026-04-06/server/src/...` and `.claude/worktrees/e2e-mock-anthropic-2026-04-06/...`; not in the main `server/src/`. The `MockAnthropicClient` LLM-stub layer is not part of the tested code on main.

**Per-file runtime:** not collected. The brief said "if vitest output is available"; no run was performed by this audit (read-only scope). Recommend the next audit attach a `pnpm test --reporter=verbose` log so deletion candidates can be ranked by wall-clock too.

---

## 2. Confidence theater findings

### Anti-pattern 1: Self-mock (`vi.mock` of the module under test)

**No instances found.** Every `vi.mock` call in the suite targets a dependency, not the file under test.

### Anti-pattern 2: Mocked dependency that IS the thing being tested

**2 instances, both in the LLM consumer surface.**

- `server/src/services/agent.service.test.ts:33-35`
  ```ts
  vi.mock('app/prompts/system-prompt.js', () => ({
    buildSystemPrompt: vi.fn().mockReturnValue('You are a travel planner.'),
  }));
  ```
  `agent.service.ts` consumes `buildSystemPrompt` and ships its output to Anthropic. The agent loop's correctness depends on the actual prompt text (rules, tool descriptions, phase addenda). The test replaces it with the literal string `'You are a travel planner.'` and never asserts on the real shape. Any regression in the real prompt builder (the exact failure mode the Doppelscript Haiku fence bug taught) sails through.
- `server/src/services/agent.service.test.ts:24-32`
  ```ts
  vi.mock('app/tools/definitions.js', () => ({
    TOOL_DEFINITIONS: [{ name: 'search_flights', ... }],
  }));
  ```
  The agent's tool dispatch is the unit under test, but the canonical `TOOL_DEFINITIONS` (which is what production hands to Claude) is replaced with a one-element stub. Schema drift in the real definitions is invisible to this test.

### Anti-pattern 3: Mock-call assertions without behavior assertions

**3 instances, borderline.**

- `server/src/services/metrics.service.test.ts:17-50` Every test asserts only `mockLogger.info` was called with a structured object. The metrics service's only behavior is forwarding to logger, so this is debatable; flagging because the test gives no signal that the _consumer_ (log aggregator) parses the same shape.
- `server/src/services/agent.service.test.ts:343-387` ("logs tool calls for observability") asserts only `insertToolCallLog` was called with a partial object. No assertion that the return value of `runAgentLoop` reflects the logging path. The fire-and-forget nature plus the partial-object matcher means a regression in _what_ is logged would still pass as long as the three asserted fields are present.
- `server/src/handlers/chat/chat.test.ts:14` mocks `app/services/agent.service.js` wholesale, which collapses every chat-handler test into "did we call agent.service correctly" rather than "did the chat endpoint produce correct SSE output." See anti-pattern 5 below; this is the worst offender.

### Anti-pattern 4: Snapshot-only tests

**No instances found.** `grep -r 'toMatchSnapshot\|toMatchInlineSnapshot' --include='*.test.*'` returns nothing across all suites.

### Anti-pattern 5: Mocking the integration boundary the test claims to cross

**5 instances, all material.**

1. **Repository tests mock the database pool.** Documented as a project convention but worth naming as a coverage gap rather than a bug.
   - `server/src/repositories/trips/trips.test.ts:13-19` mocks `app/db/pool/pool.js`.
   - `server/src/repositories/conversations/conversations.test.ts:9-11` mocks `query`.
   - `server/src/repositories/auth/auth.test.ts`, `server/src/repositories/userPreferences/userPreferences.test.ts`, `server/src/repositories/tool-call-log/tool-call-log.test.ts` follow the same pattern.
     These tests verify SQL string composition and parameter ordering, which is fine, but they cannot catch a column-name typo, a missing migration, a broken `JOIN`, or an `ON CONFLICT` mistake. The two real integration tests in `server/src/__integration__/` cover only the auth flow, so the entire trips / conversations / preferences SQL surface is not exercised against real Postgres anywhere.
2. **`server/src/handlers/chat/chat.test.ts:14`** mocks `app/services/agent.service.js`. The chat handler's actual job is wiring the agent loop into SSE streaming. With `runAgentLoop` mocked, the test asserts the handler converts a fake event sequence into SSE output, not that the real agent loop feeds the real handler correctly. This is a "handler integration test" in name only.
3. **`server/src/handlers/chat/chat.test.ts:30-32`** also mocks `app/services/enrichment.js` (`getEnrichmentNodes: vi.fn().mockResolvedValue([])`), so any handler test that should validate enrichment-node delivery to the client passes by returning an empty list.
4. **`server/src/services/AgentOrchestrator.test.ts:22-24`** mocks `./node-builder.js` (`buildNodeFromToolResult: vi.fn().mockReturnValue(null)`). The orchestrator's contract is "tool result → typed node → emitted event," and node building is mocked out of the loop. Node-renderer regressions cannot be detected here.
5. **`server/src/routes/routes.test.ts:10-18`** mocks the auth handlers entirely and asserts the router returns 201/200/204. This catches a path-method binding regression (legitimate goal) but the assertion that `register` returns 201 is tautological because the mock returns 201. See pattern 6.

### Anti-pattern 6: Tautological assertions

**1 instance, plus 5 borderline.**

- `server/src/routes/routes.test.ts:33-44` literally asserts `expect(res.status).toBe(201)` after the mock has been hardcoded to return 201. The test still has incidental value (it would catch `app.post('/auth/login', register)` swapping the handler), but the assertion itself is tautological. A stronger version would assert on the _handler reference_ via spy, not the response status.
- The 5 borderline cases: each `repository.test.ts` test that asserts `expect(query).toHaveBeenCalledWith('DELETE FROM ...')` is asserting "I sent the SQL string I wrote." Tautology by another name. See `server/src/repositories/trips/trips.test.ts:53-65`.

### Anti-pattern 7: Loose-shape assertions on the only path under test

**3 instances, all in `server/src/services/enrichment.test.ts`.**

- `server/src/services/enrichment.test.ts:7-29` (`getDrivingRequirements`): the only behavioral assertions are `expect(node.body).toContain('left')` and `toContain('International Driving Permit')`. The driving advisory has a structured body whose copy and rules matter; substring match passes for any prompt that mentions "left" anywhere. Acceptable for a smoke test, insufficient for a function whose entire job is producing the exact advisory text.
- `server/src/prompts/system-prompt.test.ts:7-40` asserts `result.toContain('Voyager')`, `toContain('Rules')`, `toContain('Collecting Details')`. The system prompt is _the_ artifact whose exact content drives Claude's behavior; substring assertions catch deletion of the literal word 'Voyager' but nothing else. This is the closest analogue to the Haiku fence bug: the parser/consumer of the prompt is the LLM, and the test does not validate the structural pieces (tool list, format_response section, phase addendum order).
- `server/src/services/enrichment.test.ts:6` (`expect(node).not.toBeNull()` as a leading assertion) is a `toBeDefined`-class loose check on a function whose entire purpose is computing a specific structured node.

### Anti-pattern 8: Skipped tests with no comment / triage reference

**No instances found.** Zero `.skip` / `.fixme` / `.todo` calls anywhere on main.

### Anti-pattern 9: Always-failing tests that linger

**No always-failing tests detected statically.** One always-passing dead test, however:

- `server/src/prompts/category-prompts.test.ts:1-9`
  ```ts
  describe('category-prompts (deprecated)', () => {
    it('has been replaced by single system prompt', () => {
      // Per-category prompts removed in agentic redesign.
    });
  });
  ```
  This is a placeholder with no assertions. It exists only to make `describe` non-empty. Pure dead weight.

### Anti-pattern 10: LLM-consumer tests that hand-mock the model response shape

**3 instances, the most consequential cluster in the report.**

- `server/src/services/agent.service.test.ts:43-64` defines `createMockStream` and feeds it hand-written `{ type: 'text' }` and `{ type: 'tool_use' }` blocks. No real Anthropic response (or captured fixture) is involved. The exact failure mode the brief calls out: "the test mocked the JSON the parser was supposed to consume."
- `server/src/services/AgentOrchestrator.test.ts:29-79` does the same with `makeTextResponse` and `makeToolUseResponse` helpers. The orchestrator's contract is "Anthropic SDK shape → typed events." Both ends of that contract are hand-faked. If Anthropic ships a non-breaking shape change (e.g., a new content-block type, a renamed field), neither test fails.
- `server/src/handlers/chat/chat.test.ts` (entire file) inherits both problems by mocking `agent.service` wholesale; it cannot catch any LLM-consumer regression by construction.

The fix is the canonical one: capture a real (or mock-anthropic-client-generated) Anthropic streaming session as a JSON fixture, replay it through the real `runAgentLoop`, assert on the resulting events. The `MockAnthropicClient` infrastructure to do this exists in the worktrees (`.claude/worktrees/queue-cleanup-2026-04-06/server/src/services/mock-anthropic-client/`) but has not been merged to main.

---

## 3. Bloat signals

### Test:source ratio outliers (> 1.0)

- `server/src/tools/mock/` directory: 224 LoC of test code for 192 LoC of mock fixture code (1.17:1). The fixtures are deterministic data generators that already have type-checked outputs; the tests assert "an array exists, items have these properties." See `server/src/tools/mock/experiences.mock.test.ts:6-30`. Four files in this category: `experiences.mock.test.ts`, `flights.mock.test.ts`, `hotels.mock.test.ts`, `car-rentals.mock.test.ts`. Fifth file `isMockMode.test.ts` (39 LoC) tests a 3-LoC env-var read.
- `server/src/services/AgentOrchestrator.test.ts` 462 LoC against a 268 LoC source file (1.72:1). The test is dominated by `createMockStream` / `makeTextResponse` / `makeToolUseResponse` boilerplate that fakes the Anthropic shape. See section 2 anti-pattern 10.
- `server/src/services/agent.service.test.ts` 407 LoC against a 140 LoC source file (2.91:1). Second-largest ratio in the repo. Same root cause.
- `server/src/handlers/chat/chat.test.ts` 659 LoC against a 251 LoC source file (2.63:1). Again, the 659 LoC is dominated by setup of mocks for `agent.service`, `enrichment`, repos, and the SSE event sequencing.
- `server/src/utils/tests/mockLogger.test.ts` 53 LoC for 0 source LoC of "production code" (the file under test is itself a test helper). Infinite ratio. See section 2 anti-pattern 6 / pure-tautology.

### Layered coverage on the same path (multiple layers hitting one bug)

- The chat handler path (POST /trips/:id/chat) is covered three times: `chat.test.ts` (handler unit with mocked agent), `agent.service.test.ts` (agent loop with mocked Anthropic), `AgentOrchestrator.test.ts` (orchestrator with mocked Anthropic + node-builder). All three layers mock the boundary that matters most (real Anthropic shape → real prompt → real tool dispatch). Three layers protecting the same path with the same blind spot is the textbook bloat pattern.
- The auth flow is covered twice in a productive way: real integration test (`server/src/__integration__/auth.integration.test.ts`) + canonical e2e (`e2e/auth.spec.ts`). These layers genuinely earn their keep because they exercise different surfaces (the integration test hits Express directly, the e2e test hits the rendered Next.js form). Keep both.

### Duplicated test names across files

Top duplicates from `grep "it\('" --include='*.test.ts' | sort | uniq -c`:

- `'returns 404 when trip not found'` appears 5 times (chat.test, trips.test, userPreferences.test, etc.).
- `'returns cached results when available'` appears 4 times (one per `*.tool.test.ts`).
- `'caches results after fetching'` appears 4 times.
- `'returns 401 when not authenticated'` appears 3 times.
- `'rejects invalid email'` appears 3 times.
- `'calls SerpApi and returns normalized results'` appears 3 times.

These duplications are not automatic bloat (they reflect parallel handlers), but the fact that "returns 404 when trip not found" is asserted in five different files implies the same lookup pattern is repeated five times. A shared test helper or a single integration test that exercises the lookup once would cover the same regression with one assertion instead of five.

### Tests that were never edited alongside meaningful source changes

Not computed in this audit (would require crossing `git log --follow` for each test against `git log --follow` for its source). Flagging as a follow-up for the next audit if cycle time matters; the brief said "if available."

### Top 5 slowest tests per workspace

Not collected. The brief said "if vitest output is available"; no run was performed.

---

## 4. Thinness signals

### Source files with no test file at all (load-bearing only)

Filtered to files > 50 LoC that are not boilerplate, generated data, or trivial config:

| File                                                                          |   LoC | Why it matters                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/src/services/enrichment.ts`                                           |    45 | Orchestrator that fan-outs to all 5 enrichment sources. The two source files it dispatches to (`driving`, `visa-matrix`) are tested; the orchestrator itself is not. The fix `847bcb73` (Redis graceful degradation) touches this code path and shipped without a test. |
| `server/src/services/enrichment-sources/driving.ts`                           |   360 | Largest enrichment source. Contains country-by-country driving rules that the agent uses to produce travel advisories. Only `getDrivingRequirements('JP')`, `('XX')`, `('US')` are exercised in `enrichment.test.ts`. Roughly 5 of ~50 country rules are tested.        |
| `server/src/services/enrichment-sources/fcdo.ts`                              |   269 | UK Foreign and Commonwealth Office advisories. Zero tests.                                                                                                                                                                                                              |
| `server/src/services/enrichment-sources/state-dept.ts`                        |    71 | US State Department advisories. Zero tests.                                                                                                                                                                                                                             |
| `server/src/services/enrichment-sources/open-meteo.ts`                        |   104 | Weather API integration. Zero tests; calls `fetch` with no recorded mock.                                                                                                                                                                                               |
| `server/src/services/enrichment-sources/visa-matrix.ts`                       |    85 | Visa matrix lookups. Three tests in `enrichment.test.ts` (US→JP, US→TH, US→CN). The other 50+ visa matrix entries are untested.                                                                                                                                         |
| `server/src/prompts/trip-context.ts`                                          |   257 | Builds the trip-context block injected into every Claude prompt. This is exactly the LLM-input surface the Doppelscript Haiku bug taught to test. Zero tests.                                                                                                           |
| `server/src/schemas/trips.ts`                                                 |   116 | Zod schemas for the trip object. Auth and userPreferences schemas have tests; trips do not.                                                                                                                                                                             |
| `server/src/routes/trips.ts`, `routes/userPreferences.ts`, `routes/places.ts` |   n/a | Only the auth router is covered by `routes.test.ts`.                                                                                                                                                                                                                    |
| `server/src/data/cities.ts`                                                   | 1,862 | Generated data; safe to skip.                                                                                                                                                                                                                                           |
| `server/src/app.ts`                                                           |   179 | Express app composition. Implicitly exercised by integration tests but never asserted directly.                                                                                                                                                                         |

### Web-client untested source files (load-bearing only)

The `web-client` workspace has 60 source files and 3 test files. The 3 components covered (Toast, AuthGuard, SelectableCardGroup) are correct and valuable. The untested set includes every component that was directly involved in the 9-fix-commit ChatBox churn cluster from the process retrospective:

- `web-client/src/components/ChatBox/ChatBox.tsx` (241 LoC); center of the 2026-04-02 9-fix cluster.
- `web-client/src/components/ChatBox/NodeRenderer.tsx` (146 LoC); same cluster.
- `web-client/src/components/ChatBox/TripDetailsForm.tsx` (222 LoC); touched by `69b0eaf8 → de36b802 → f56b4417` (the welcome-message + form rendering UX whiplash).
- `web-client/src/components/ChatBox/VirtualizedChat.tsx` (187 LoC); virtualized list rendering, the source of "tool cards disappear after stream end" bugs.
- `web-client/src/components/PreferencesWizard/PreferencesWizard.tsx` (314 LoC); multi-step form, no tests.
- `web-client/src/components/MockChatBox/MockChatBox.tsx` (306 LoC); the public landing-page demo. Bug `B8407D0A` (mock chat height) shipped without a test.
- `web-client/src/app/(protected)/trips/[id]/page.tsx` (366 LoC); the trip detail page that orchestrates all of the above.
- `web-client/src/components/BookingConfirmation/BookingConfirmation.tsx` (240 LoC).
- All app routes (`(auth)/login`, `(auth)/register`, `explore/[slug]`, `account/page.tsx`).

**Every file involved in the retrospective's bug clusters 2 and 3 has zero unit-test coverage today.** That is the headline thinness finding.

### Cross-reference: fix commits with no tests, mapped to current coverage

From the retrospective: 27 of 35 violator commits are real logic-change fixes that shipped without tests. Spot check of where those source files stand today:

- `server/src/handlers/chat/chat.ts` (touched by 9 of the 27 violators) → has `chat.test.ts`, but mocks `agent.service.js` and `enrichment.js`, so the SSE-stream-end bugs that prompted those fixes still cannot be reproduced in the unit test today.
- `web-client/src/components/ChatBox/*.tsx` (touched by ~6 of the 27 violators) → still has zero tests.
- `server/src/data/destinations.json` Docker-copy fix (`bea33cc5`, `90470b14`) → no smoke test asserting `dist/destinations.json` exists post-build. Recommended in section 7.
- `server/src/utils/rateLimiter.ts` IPv6 fix in `bea33cc5` → file is _excluded_ from coverage by `vitest.config.ts:18` (`'**/rateLimiter.ts'`). The exclusion is itself suspicious; the file produced a production crash and is now untested by policy.

### Branch coverage gaps

Not measured in this audit. `vitest.config.ts:27-32` declares 80/80/80/80 thresholds, so a `pnpm test:coverage` run would surface the actual numbers. Recommend the next pass attach the lcov.

### User stories without real E2E coverage

The canonical `e2e/` directory covers two user-facing flows:

- Login + register + logout + protected-route redirect (`auth.spec.ts`).
- Page-loads-and-has-an-input-field on /login and /register (`navigation.spec.ts`).

User stories US-1 through US-35 in `web-client/e2e/` (the legacy suite) cover the full surface (explore, chat, trips, checkout, preferences, account). The legacy suite runs against `web-client/playwright.config.ts` (separate config), uses `if (await ... .isVisible().catch(() => false))` conditional patterns extensively (see anti-pattern 5b below), and is slated for deletion. **If the legacy suite is deleted before the canonical suite is expanded, the repo loses E2E coverage on 24 of 26 documented user stories overnight.** That is the most urgent thinness finding.

### Conditional E2E patterns in legacy suite (passing-when-feature-absent)

Nine instances across `web-client/e2e/preferences.spec.ts:17,48,63,73`, `checkout.spec.ts:23,44`, `trips.spec.ts:22,66,70`. Each follows the shape `if (await locator.isVisible().catch(() => false)) { expect(...).toBeVisible() }`. If the feature is missing, the test passes silently. This is a confidence-theater hatch in the legacy suite, separate from the deletion plan, and explains why the 9 fix-commit ChatBox cluster shipped past these tests.

---

## 5. Direct answers (questions 1 to 7)

### 1. Test files I would bet $100 catch a real regression

- `server/src/__integration__/auth.integration.test.ts`; real Express + real Postgres + real session cookies. Would catch any auth-flow regression.
- `server/src/__integration__/cors.integration.test.ts`; same shape, real CORS round-trip. CORS regressions are a documented painful incident class for this team.
- `server/src/utils/parsers/parseIdParam.test.ts` and `parsePagination.test.ts`; pure functions, real values, behavioral assertions on the only thing the function computes.
- `server/src/services/node-builder.test.ts`; real input shapes, real type narrowing, no mock layer between the test and the unit.
- `server/src/utils/CircuitBreaker.test.ts`; real time, real state machine, behavioral assertions.
- `server/src/middleware/csrfGuard/csrfGuard.test.ts`, `errorHandler.test.ts`, `requireAuth.test.ts`, `notFoundHandler.test.ts`, `rateLimiter.test.ts`; supertest with real Express middleware. Would catch the next CSRF or rate-limiter regression.
- `server/src/tools/executor.test.ts`; Zod validation on real schemas, dispatch logic on real input.
- `server/src/handlers/chat/chat.helpers.test.ts`; pure helpers with real `TripWithDetails` shapes.
- `server/src/prompts/booking-steps.test.ts`; pure-function migration logic with concrete v1 → v2 fixtures.
- `web-client/src/components/SelectableCardGroup.test.tsx`, `Toast.test.tsx`, `AuthGuard.test.tsx`; Testing Library queries on real DOM with userEvent.
- `e2e/auth.spec.ts`; real browser, real form submission, real cookies.

### 2. Test files that are confidence theater

- `server/src/utils/tests/mockLogger.test.ts`; tests that vitest's `vi.fn()` works. Pure tautology.
- `server/src/prompts/category-prompts.test.ts`; placeholder with no assertions.
- `server/src/services/agent.service.test.ts`; anti-patterns 2, 3, 10 (mocks the prompt builder, the tool definitions, the Anthropic stream shape).
- `server/src/services/AgentOrchestrator.test.ts`; anti-patterns 5, 10 (mocks node-builder, hand-fakes Anthropic shape).
- `server/src/handlers/chat/chat.test.ts`; anti-pattern 5 (mocks agent.service and enrichment service, the two boundaries the handler is supposed to integrate with).
- All four `server/src/tools/mock/*.mock.test.ts` files; tests of mock data generators that cannot regress without breaking type checks first.
- The legacy `web-client/e2e/` `if (await ... .isVisible())` conditional tests in `preferences.spec.ts`, `checkout.spec.ts`, `trips.spec.ts`.
- `server/src/services/metrics.service.test.ts`; borderline; only asserts pass-through to logger.

### 3. Source files that are load-bearing AND have zero coverage

- `server/src/prompts/trip-context.ts` (257 LoC); every Claude call's context block.
- `server/src/services/enrichment.ts` (45 LoC); fan-out orchestrator; touched by a known production fix without a test.
- `server/src/services/enrichment-sources/fcdo.ts` (269 LoC).
- `server/src/services/enrichment-sources/open-meteo.ts` (104 LoC).
- `server/src/services/enrichment-sources/state-dept.ts` (71 LoC).
- `server/src/utils/rateLimiter.ts`; _intentionally_ excluded from coverage at `vitest.config.ts:18` even though it produced the `bea33cc5` production crash. Remove the exclusion and add a test.
- `web-client/src/components/ChatBox/ChatBox.tsx` (241 LoC).
- `web-client/src/components/ChatBox/TripDetailsForm.tsx` (222 LoC); directly inside the welcome-message UX whiplash cluster.
- `web-client/src/components/ChatBox/NodeRenderer.tsx` (146 LoC).
- `web-client/src/components/ChatBox/VirtualizedChat.tsx` (187 LoC).
- `web-client/src/components/PreferencesWizard/PreferencesWizard.tsx` (314 LoC).
- `server/src/schemas/trips.ts` (116 LoC).

### 4. Are the test layers each earning their keep?

- **server unit:** mostly. The pure-function and middleware layers are doing real work. The agent / chat / orchestrator layer is duplicated three ways and earns nothing because all three layers mock the same boundary. Collapse the LLM-loop tests into one fixture-replay test against the real prompt + real tool defs + real (captured) Anthropic stream. The other 30+ unit tests stand on their own.
- **server integration:** absolutely. Two files, 11 tests, irreplaceable signal. These should grow, not shrink.
- **web-client component:** the three existing tests are good. The layer is so thin it would be dishonest to call it "earning its keep"; it covers 3 of 60 source files. Either grow it or admit it does not exist as a layer.
- **canonical e2e (`e2e/`):** earning its keep for auth and navigation, but covers 5 of ~26 user stories. Same verdict as web-client component: grow or stop calling it a layer.
- **legacy e2e (`web-client/e2e/`):** redundant with the canonical suite _in intent_, but the canonical suite has not yet absorbed the legacy coverage. **Do not delete the legacy suite until the canonical suite covers the same user stories with non-conditional assertions.** The brief frames this as already-decided; the data says it is not yet safe.
- **nightly real-API:** does not exist on main. The brief and shared conventions assume a separate nightly suite that hits real SerpApi / Google Places / Anthropic; no such workflow file or scripts exist. This is a missing layer, not a redundant one.

### 5. Wall-clock runtime of the smallest passing set after deletion

Without a real `vitest --reporter=verbose` run this is a model. Estimated breakdown:

- Server unit (47 → estimated 35 after deletion): roughly 12 to 18 seconds (most are pure-function + supertest in-process).
- Server integration: about 4 to 8 seconds against a local Postgres.
- Web-client component (3 → 8 to 10 after additions): about 3 to 5 seconds.
- Canonical e2e (2 → 6 to 8 spec files after additions): about 60 to 90 seconds against the dev server.
- Total: under 2 minutes for the smallest _useful_ set, comparable to today's wall clock minus the deleted dead weight.

### 6. Tests I would delete right now if I had the authority

1. `server/src/utils/tests/mockLogger.test.ts`; entire file. Tests vitest itself.
2. `server/src/prompts/category-prompts.test.ts`; entire file. Empty placeholder.
3. `server/src/tools/mock/experiences.mock.test.ts`; entire file. Asserts shape of a fixture generator that already has type checks.
4. `server/src/tools/mock/flights.mock.test.ts`; same.
5. `server/src/tools/mock/hotels.mock.test.ts`; same.
6. `server/src/tools/mock/car-rentals.mock.test.ts`; same.
7. `server/src/tools/mock/isMockMode.test.ts`; 39 LoC of tests for a 3-LoC env-var read. Replace with an inline `expect(isMockMode()).toBe(false)` somewhere already needed.
8. `server/src/services/agent.service.test.ts`; entire file. Replaced by the recommended fixture-replay test in section 7. Removing it does not lose coverage that the new test does not provide more reliably.
9. `server/src/services/AgentOrchestrator.test.ts`; entire file. Same reason.
10. The 9 conditional `if (await ... .isVisible())` tests in `web-client/e2e/preferences.spec.ts`, `checkout.spec.ts`, `trips.spec.ts`. Either rewrite as unconditional or delete; passing-when-absent is worse than no test.

**Expected source-file LoC affected by all 10 deletions:** zero. **Expected test-file LoC removed:** 1,180 LoC (53 + 9 + 37 + 55 + 42 + 51 + 39 + 407 + 462 + ~25 conditional blocks). **Expected branch coverage delta:** if the recommended additions in section 7 are made in the same session, net coverage _increases_. If deletions ship alone, branch coverage on `agent.service.ts` and `AgentOrchestrator.ts` drops to zero.

### 7. Tests I would ADD right now if I had the authority

1. **One integration test for `runAgentLoop` that uses a captured Anthropic streaming session as a JSON fixture.** The orchestrator runs against the real `buildSystemPrompt`, the real `TOOL_DEFINITIONS`, and a recorded multi-turn Anthropic transcript. Asserts on the structured events emitted, the final response shape, and the tool-call sequence. Replaces both `agent.service.test.ts` and `AgentOrchestrator.test.ts`. Location: `server/src/services/__fixtures__/anthropic-trip-planning.json` + `server/src/services/agent.fixture.test.ts`.
2. **`server/src/prompts/trip-context.test.ts`**; pure function, structured trip object in, prompt block out. Assert on the entire output, not substrings. This is the function the LLM consumes; behave like a parser test.
3. **`server/src/services/enrichment.test.ts` expansion**; exercise the orchestrator (`getEnrichmentNodes`) with a fake source returning `null`, with a source throwing, and with all sources returning real nodes. The current file only tests two of the leaf sources.
4. **`server/src/services/enrichment-sources/open-meteo.test.ts`**; `global.fetch` mock with a recorded Open-Meteo response. Same shape as `serpapi.service.test.ts`.
5. **A build-output smoke test** in `server/scripts/` that asserts `dist/destinations.json` and `dist/driving-requirements.json` exist after `pnpm build`. This is the missing test for `bea33cc5`.
6. **`server/src/utils/rateLimiter.test.ts`** plus removal of `'**/rateLimiter.ts'` from `vitest.config.ts:18`. The IPv6 validation fix in `bea33cc5` shipped against an excluded file.
7. **Unit tests for the ChatBox cluster:** at minimum `ChatBox.test.tsx`, `TripDetailsForm.test.tsx`, `NodeRenderer.test.tsx`. Each should drive the welcome-message + missing-fields-form state machine that produced the `69b0eaf8 → de36b802 → f56b4417` whiplash. One test per state transition.
8. **Canonical e2e expansion:** `e2e/chat.spec.ts` and `e2e/trips.spec.ts` covering US-13, US-14, US-18, US-20, US-21 with no conditional `if (await ... .isVisible())` patterns. Use the `MockAnthropicClient` infrastructure from the worktrees so the chat tests run deterministically without real Anthropic calls.
9. **`server/src/__integration__/trips.integration.test.ts`**; real Express + real DB exercising trip CRUD. The repository unit tests cannot catch column-name typos; this would. Same shape as the existing `auth.integration.test.ts`.
10. **One test that fires two simultaneous POST /trips/:id/chat requests** to verify the conversation lock added in `7ad22496`. The fix shipped without one and the locking behavior is a tier-1 correctness invariant for the SSE / agent loop architecture.

---

## 6. Recommended deletions

Each item meets all three signals: redundant with a stronger test (existing or recommended), source has been stable, removing it does not drop branch coverage when paired with the additions in section 7.

| File / region                                                                                                                                                | Anti-pattern                            | Replaced by                                 | LoC removed |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------- | ----------: |
| `server/src/utils/tests/mockLogger.test.ts`                                                                                                                  | 6 (tautology), self-test of test helper | nothing; this test should not exist         |          53 |
| `server/src/prompts/category-prompts.test.ts`                                                                                                                | 9 (dead placeholder)                    | nothing                                     |           9 |
| `server/src/tools/mock/experiences.mock.test.ts`                                                                                                             | 3, low-value                            | TypeScript type-check                       |          37 |
| `server/src/tools/mock/flights.mock.test.ts`                                                                                                                 | 3                                       | TypeScript type-check                       |          55 |
| `server/src/tools/mock/hotels.mock.test.ts`                                                                                                                  | 3                                       | TypeScript type-check                       |          42 |
| `server/src/tools/mock/car-rentals.mock.test.ts`                                                                                                             | 3                                       | TypeScript type-check                       |          51 |
| `server/src/tools/mock/isMockMode.test.ts`                                                                                                                   | 7                                       | one inline assertion in another file        |          39 |
| `server/src/services/agent.service.test.ts`                                                                                                                  | 2, 3, 10                                | new fixture-replay test in §7.1             |         407 |
| `server/src/services/AgentOrchestrator.test.ts`                                                                                                              | 5, 10                                   | new fixture-replay test in §7.1             |         462 |
| Conditional `if (await ... .isVisible())` blocks across `web-client/e2e/preferences.spec.ts:17,48,63,73`, `checkout.spec.ts:23,44`, `trips.spec.ts:22,66,70` | 9 (silently passing)                    | unconditional canonical-suite tests in §7.8 |         ~25 |

**Total LoC removed:** ~1,180. **Source files affected:** 0. **Branch coverage delta when paired with §7 additions:** net positive.

**Conditional deletion (paired):** `web-client/e2e/` entire directory. Only after the canonical `e2e/` suite covers US-1 through US-35. **Do not delete in the same commit** as the additions; deletion of the legacy suite must trail the canonical-suite expansion by at least one passing CI run.

---

## 7. Recommended additions

See section 5, question 7 for the prioritized list. Repeated as a checklist:

1. `server/src/services/agent.fixture.test.ts` plus `__fixtures__/anthropic-trip-planning.json` (replaces deletions of `agent.service.test.ts` and `AgentOrchestrator.test.ts`).
2. `server/src/prompts/trip-context.test.ts`.
3. `server/src/services/enrichment.test.ts` expansion (orchestrator paths).
4. `server/src/services/enrichment-sources/open-meteo.test.ts`.
5. `server/scripts/test-dist-assets.sh` or `server/src/__build__/dist-assets.test.ts`.
6. `server/src/utils/rateLimiter.test.ts` plus `vitest.config.ts:18` exclusion removal.
7. ChatBox cluster tests: `ChatBox.test.tsx`, `TripDetailsForm.test.tsx`, `NodeRenderer.test.tsx`.
8. `e2e/chat.spec.ts` and `e2e/trips.spec.ts` (plus `e2e/preferences.spec.ts` and `e2e/checkout.spec.ts`) using `MockAnthropicClient`.
9. `server/src/__integration__/trips.integration.test.ts`.
10. Concurrency test for the conversation lock in chat handler.

---

## 8. Recommended rewrites (confidence theater)

| File                                               | Anti-pattern                                    | Required change                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `server/src/handlers/chat/chat.test.ts`            | 5 (mocks the boundary the test claims to cross) | Stop mocking `app/services/agent.service.js` and `app/services/enrichment.js`. Either move the file to `server/src/__integration__/chat.integration.test.ts` and run it against real services with a `MockAnthropicClient`, or shrink it to the validation-error and 404 cases only and let the integration test cover the SSE path. |
| `server/src/prompts/system-prompt.test.ts`         | 7 (loose substring on the only path under test) | Replace `toContain('Voyager')` style assertions with structural assertions: parse the prompt into sections, assert each section is present in the right order, assert the tool list matches the real `TOOL_DEFINITIONS` length. The literal-content tests can stay but should not be the only assertions.                            |
| `server/src/services/enrichment.test.ts`           | 7                                               | Expand from substring assertions to full-object equality on a representative subset of countries. Add fixture-based assertions on the entire driving-rules set, not 3 of 50.                                                                                                                                                         |
| `server/src/services/metrics.service.test.ts`      | 3                                               | Add at least one test that consumes the structured log from a real downstream parser (or a JSON-schema validator) to prove the shape is contractual, not just whatever the wrapper happens to emit.                                                                                                                                  |
| `server/src/routes/routes.test.ts`                 | 6 (tautological)                                | Replace status-code assertions with spy-based assertions on which handler reference was bound to which path. The status code came from the mock, not the router.                                                                                                                                                                     |
| `server/src/repositories/*/`\*`.test.ts` (5 files) | 5                                               | Keep as-is for SQL composition signal, **but** also add one integration test per repository (real DB, real schema). The unit tests are not bugs; they are insufficient on their own.                                                                                                                                                 |

---

## 9. Anomalies worth watching

- **`vitest.config.ts:18` excludes `'**/rateLimiter.ts'` from coverage** even though that file produced a production crash 48 hours ago (`bea33cc5`). Coverage exclusions on files with recent incidents are a red flag.
- **The `MockAnthropicClient` infrastructure exists in two worktrees but not on main.** `.claude/worktrees/queue-cleanup-2026-04-06/server/src/services/mock-anthropic-client/` and `.claude/worktrees/e2e-mock-anthropic-2026-04-06/server/src/services/mock-anthropic-client/` both contain a tested mock client. The recommended fixture-replay test in §7.1 depends on this infrastructure landing on main first.
- **Three independent `style: format all files` commits** in the retrospective imply the pre-commit hook was uninstalled multiple times. If the same pattern is recurring for test hooks, the test suite is not actually gating commits even when it appears to be. Worth verifying `git config --local core.hooksPath` and running `npx lefthook install` as a cleanup step.
- **The brief mentioned 10 `test.fixme` markers** in `e2e/`. Zero exist on main. Either the markers were removed without unblocking the tests they marked, or the brief is referring to a worktree state. Worth reconciling.
- **`server/src/handlers/chat/chat.test.ts` is 659 LoC, the largest test file in the repo.** A test file that large for a 251-LoC handler is a code smell on its own; combined with the boundary-mocking pattern it amounts to a 2.6:1 setup-to-source ratio for tests that cannot reproduce the bugs the handler actually shipped.
- **Web-client component-test layer ratio of 0.02** is the kind of number that reads as "we have a layer" but functionally is "we have three tests." Avoid the framing trap; either commit to the layer or stop counting it.
- **No LLM-output captured fixtures anywhere on main.** The closest is `server/src/services/__fixtures__/` which does not exist. Every LLM-consumer test in the repo today fakes the response shape inline. This is the single largest confidence-theater surface and the precise failure mode the global rules call out.

---

**Report path:** `/Users/iangreenough/Desktop/code/personal/production/voyager/docs/audits/2026-04-06-test-suite-evaluation.md`
