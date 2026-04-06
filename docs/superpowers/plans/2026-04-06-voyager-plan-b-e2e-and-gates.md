# Plan B: Voyager E2E Coverage and Test Gates

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the E2E test coverage backbone (35 story tests + 3 journey tests, mocked externals) and wire it into pre-push and CI test gates per the spec at `docs/superpowers/specs/2026-04-06-doppelscript-learnings-to-voyager-design.md`.

**Scope:** Phase 4 and Phase 5 Parts A/B/C of the source spec. Phase 5 Part D (P0/P1 fixes) is a separate plan (Plan C).

**Prerequisites from triage (must land before this plan runs):**

- **[ENG-04]** Tool executor has no per-tool adapter seam. This is a P1 prerequisite from Plan A's triage. The adapter refactor must land before E2E mocking is possible. Plan C Task 1 should address this. If Plan C has not shipped ENG-04, Plan B cannot execute cleanly.

**Architecture:** Playwright E2E suite in `e2e/` with the hybrid structure (one test per user story + 3 journey tests). External APIs mocked via server-side `E2E_MOCK_TOOLS=1` flag that swaps real SerpApi / Google Places clients for fixture-returning adapters. Real Anthropic API is called (reuse prod key per spec decision). Pre-push lefthook runs a fast lane (~30s). CI runs the full suite on every push. Nightly workflow runs a separate small real-API suite against live endpoints.

**Working branch:** new worktree `plan/e2e-and-gates-2026-04-06` created from `main` after Plan A's audit branch merges to main.

**Source spec sections:** Phase 4 (E2E coverage), Phase 5 Parts A, B, C.

---

## File structure

```
voyager/
├── e2e/
│   ├── fixtures/
│   │   ├── mock-serpapi.ts            [CREATE]
│   │   ├── mock-google-places.ts      [CREATE]
│   │   └── test-users.ts              [CREATE]
│   ├── helpers/
│   │   ├── auth.ts                    [CREATE]
│   │   ├── chat.ts                    [CREATE]
│   │   └── trip.ts                    [CREATE]
│   ├── public-pages.spec.ts           [CREATE] US-1 to US-7
│   ├── auth.spec.ts                   [MODIFY] US-8 to US-12
│   ├── trip-management.spec.ts        [CREATE] US-13 to US-17
│   ├── chat-booking-flow.spec.ts      [CREATE] US-18 to US-24
│   ├── checkout.spec.ts               [CREATE] US-25 to US-28
│   ├── preferences.spec.ts            [CREATE] US-29 to US-33
│   ├── account.spec.ts                [CREATE] US-34 to US-35
│   ├── navigation.spec.ts             [MODIFY] general nav (already exists)
│   ├── real-apis/
│   │   └── smoke.spec.ts              [CREATE] nightly real-API smoke
│   └── journeys/
│       ├── happy-path-booking.spec.ts       [CREATE]
│       ├── returning-user-iterates.spec.ts  [CREATE]
│       └── failure-path.spec.ts             [CREATE]
├── lefthook.yml                       [MODIFY] add test:e2e:fast
├── package.json                       [MODIFY] add test:e2e:fast script
├── scripts/
│   └── e2e-precheck.sh                [CREATE] Postgres + Redis health
└── .github/workflows/
    ├── ci.yml                         [MODIFY] add e2e job
    ├── e2e.yml                        [CREATE] full E2E suite
    └── e2e-real-apis.yml              [CREATE] nightly real-API smoke
```

---

## Tasks

Plan B has 24 tasks. Group by phase:

- **Phase 4.0** (Tasks 1-3): prerequisites and scaffolding
- **Phase 4.1** (Tasks 4-9): fixtures, helpers, mock layer
- **Phase 4.2** (Tasks 10-19): story test files (one task per spec file, each task implements all stories in that file TDD-style)
- **Phase 4.3** (Tasks 20-22): 3 journey tests
- **Phase 5.A** (Task 23): pre-push fast lane
- **Phase 5.B** (Task 24): CI full suite + nightly real-API workflow
- **Phase 5.C** (Task 25): exit verification and handoff to Plan C

---

## Task 1: Verify ENG-04 prerequisite (tool executor adapter seam)

**Files:** none modified; read-only check.

- [ ] **Step 1:** Verify `server/src/tools/executor.ts` accepts a `toolAdapters` parameter on the `AgentOrchestrator` constructor and passes it through to the executor. If not, **stop** and notify the user that Plan C must fix ENG-04 before Plan B can proceed.

- [ ] **Step 2:** Verify `E2E_MOCK_TOOLS=1` env flag is recognized by the server and swaps real SerpApi / Google Places / flight / hotel / experience clients for test adapters.

- [ ] **Step 3:** Verify `playwright.config.ts` passes `E2E_MOCK_TOOLS=1` in the `webServer.env` section.

- [ ] **Step 4:** If any of the above checks fails, **stop executing this plan** and report the blocker. Do NOT attempt to build E2E coverage on top of an adapter seam that does not exist.

---

## Task 2: Create worktree for Plan B execution

**Files:** none modified (worktree setup).

- [ ] **Step 1:** From the main Voyager repo (not a sub-worktree), create a worktree:

```bash
git worktree add .claude/worktrees/plan-b-e2e-2026-04-06 -b plan/e2e-and-gates-2026-04-06
cd .claude/worktrees/plan-b-e2e-2026-04-06
```

- [ ] **Step 2:** Install dependencies: `pnpm install --frozen-lockfile`

- [ ] **Step 3:** Verify clean baseline: `pnpm format:check && pnpm lint && pnpm build`

---

## Task 3: Scaffold e2e/ directory structure

**Files:**

- Create: `e2e/fixtures/`, `e2e/helpers/`, `e2e/journeys/`, `e2e/real-apis/`

- [ ] **Step 1:** Create empty directories via `mkdir -p e2e/fixtures e2e/helpers e2e/journeys e2e/real-apis`. Add `.gitkeep` files if needed.

---

## Task 4: Write mock-serpapi.ts fixture

**Files:**

- Create: `e2e/fixtures/mock-serpapi.ts`

- [ ] **Step 1: Write the fixture**

Provide fake flight and hotel responses matching SerpApi's Google Flights and Google Hotels JSON shapes. Include both happy-path and edge-case responses:

- Happy path: 3 flights DEN to SFO, 3 hotels in SF
- Empty results: 0 flights (edge case)
- Rate-limit error: 429 HTTP status simulation

- [ ] **Step 2:** Export a `getMockSerpApi(scenario: 'happy' | 'empty' | 'ratelimit')` function that returns the appropriate fixture.

- [ ] **Step 3:** Run `pnpm format:check` to ensure Prettier-clean.

---

## Task 5: Write mock-google-places.ts fixture

**Files:**

- Create: `e2e/fixtures/mock-google-places.ts`

- [ ] **Step 1:** Provide fake experiences and restaurant results matching the Google Places Text Search (New) API shape. Include fields: `id`, `displayName`, `formattedAddress`, `rating`, `priceLevel`, `primaryTypeDisplayName`, `photos`, `location`.

- [ ] **Step 2:** Export `getMockGooglePlaces(scenario: 'happy' | 'empty')`.

- [ ] **Step 3:** Format check.

---

## Task 6: Write test-users.ts fixture

**Files:**

- Create: `e2e/fixtures/test-users.ts`

- [ ] **Step 1:** Define seeded user factories for auth scenarios:
  - `newUser()`: fresh registration
  - `existingUser()`: pre-registered with no trips
  - `userWithTrips()`: pre-registered with a saved trip
  - `userWithCompletedPreferences()`: finished wizard
  - `userWithIncompletePreferences()`: wizard skipped or partial

- [ ] **Step 2:** Provide a `seedUser(factoryFn)` helper that creates the user via the backend API before the test runs and cleans up after.

---

## Task 7: Write helpers/auth.ts

**Files:**

- Create: `e2e/helpers/auth.ts`

- [ ] **Step 1:** Page-object helpers:
  - `register(page, { email, password })`
  - `login(page, { email, password })`
  - `logout(page)`
  - `assertLoggedIn(page)`
  - `assertLoggedOut(page)`

---

## Task 8: Write helpers/chat.ts

**Files:**

- Create: `e2e/helpers/chat.ts`

- [ ] **Step 1:** Chat interaction helpers:
  - `sendMessage(page, text)`
  - `waitForAgentResponse(page, { timeoutMs? })`
  - `assertToolCallIndicator(page, toolName)`
  - `selectTileCard(page, cardSelector)`
  - `assertStreamingText(page, expectedSubstring)`

---

## Task 9: Write helpers/trip.ts

**Files:**

- Create: `e2e/helpers/trip.ts`

- [ ] **Step 1:** Trip lifecycle helpers:
  - `createTrip(page)`
  - `loadTrip(page, tripId)`
  - `saveTrip(page)`
  - `deleteTrip(page, tripId, { confirm: true })`
  - `assertTripInList(page, tripDestination)`

---

## Task 10: Write public-pages.spec.ts (US-1 to US-7)

**Files:**

- Create: `e2e/public-pages.spec.ts`

- [ ] **Step 1: Read USER_STORIES.md lines 1-110** to confirm exact US-1 through US-7 acceptance criteria.

- [ ] **Step 2: Write 7 tests in TDD fashion.** For each story, write the test first, run it against the current implementation, expect some to fail, then fix the spec if needed:

```typescript
import { expect, test } from '@playwright/test';

test.describe('Public pages', () => {
  test('US-1: home page discovery (@fast)', async ({ page }) => {
    await page.goto('/');
    // Assertions: hero carousel present, feature cards visible, MockChatBox demo plays, CTAs prominent
  });

  test('US-2: browse destinations', async ({ page }) => {
    await page.goto('/explore');
    // Assert 30 destination cards
  });

  // ... US-3 through US-7
});
```

- [ ] **Step 3:** Run `pnpm playwright test e2e/public-pages.spec.ts` against the local server with `E2E_MOCK_TOOLS=1`. Record which tests fail and why.

- [ ] **Step 4:** For tests that fail due to known P0/P1 bugs from the triage (e.g., US-4 destination detail page may not exist), do NOT try to fix the bug in this plan. Mark those tests as `test.fixme()` with a comment pointing to the triage ID, and continue.

- [ ] **Step 5:** Commit: `test(e2e): add public-pages spec covering US-1 through US-7`

---

## Task 11: Update auth.spec.ts (US-8 to US-12)

**Files:**

- Modify: `e2e/auth.spec.ts` (already exists, partial coverage)

- [ ] **Step 1:** Audit the existing file. Confirm which of US-8 through US-12 are already covered.

- [ ] **Step 2:** Add missing tests with explicit US-N: prefix in test names.

- [ ] **Step 3:** Run and commit.

---

## Task 12: Write trip-management.spec.ts (US-13 to US-17)

**Files:**

- Create: `e2e/trip-management.spec.ts`

- [ ] **Step 1:** Write 5 tests for US-13 (view my trips), US-14 (create a new trip), US-15 (view trip detail), US-16 (delete a trip), US-17 (trip cards with images).

- [ ] **Step 2:** For US-16 (delete without confirmation, triage P0 UX-01): write the test expecting the CORRECT behavior (a confirmation dialog must appear). This test will FAIL until Plan C fixes UX-01. Mark as `test.fixme(..., "blocked by UX-01 triage")`.

- [ ] **Step 3:** Commit.

---

## Task 13: Write chat-booking-flow.spec.ts (US-18 to US-24)

**Files:**

- Create: `e2e/chat-booking-flow.spec.ts`

- [ ] **Step 1:** Write 7 tests. US-18 (welcome), US-19 (form), US-20 (optimistic send), US-21 (agent response + tool progress), US-22 (browse tile cards), US-23 (select tile), US-24 (quick reply chips).

- [ ] **Step 2:** These tests depend on the mocked tool layer (`E2E_MOCK_TOOLS=1`). The mock SerpApi and mock Google Places fixtures should produce deterministic flight/hotel/experience results.

- [ ] **Step 3:** Commit.

---

## Task 14: Write checkout.spec.ts (US-25 to US-28)

**Files:**

- Create: `e2e/checkout.spec.ts`

- [ ] **Step 1:** 4 tests: US-25 (open booking confirmation modal), US-26 (itemized breakdown), US-27 (confirm and book), US-28 (booked trip locked state).

- [ ] **Step 2:** US-27 (no cancel during booking animation, triage P0 UX-02): write the test expecting the CORRECT behavior (a cancel affordance must be visible). Mark `test.fixme(..., "blocked by UX-02 triage")`.

- [ ] **Step 3:** Commit.

---

## Task 15: Write preferences.spec.ts (US-29 to US-33)

**Files:**

- Create: `e2e/preferences.spec.ts`

- [ ] **Step 1:** 5 tests for the preferences wizard and editing flow.

---

## Task 16: Write account.spec.ts (US-34, US-35)

**Files:**

- Create: `e2e/account.spec.ts`

- [ ] **Step 1:** 2 tests: US-34 (view account details), US-35 (preference completion status).

---

## Task 17: Verify 35 story tests exist and are named correctly

**Files:** none modified; verification only.

- [ ] **Step 1:** Run `grep -rE "test\('US-[0-9]+:" e2e/` and count. Expected: 35 matches.

- [ ] **Step 2:** Run `grep -rE "test\('US-[0-9]+:" e2e/ | sort -u` to verify no duplicates and no missing story IDs.

- [ ] **Step 3:** If any US-N is missing or duplicated, investigate and fix before proceeding.

---

## Task 18: Write journeys/happy-path-booking.spec.ts

**Files:**

- Create: `e2e/journeys/happy-path-booking.spec.ts`

- [ ] **Step 1:** Write a single `test()` that exercises the full happy path across US-1 -> US-2 -> US-5 -> US-8 (register) -> US-29 (wizard) -> US-14 (create) -> US-20 (send) -> US-22 (tiles) -> US-23 (select) -> US-25 (modal) -> US-27 (confirm). Tag with `@fast` since this is the backbone smoke test.

---

## Task 19: Write journeys/returning-user-iterates.spec.ts

**Files:**

- Create: `e2e/journeys/returning-user-iterates.spec.ts`

- [ ] **Step 1:** Login (US-9) -> view trips (US-13) -> open trip (US-15) -> send follow-up message (US-20) -> select different tile (US-23) -> save. Uses seeded `userWithTrips()` from fixtures.

---

## Task 20: Write journeys/failure-path.spec.ts

**Files:**

- Create: `e2e/journeys/failure-path.spec.ts`

- [ ] **Step 1:** Protected route redirect (US-12) -> failed login (US-10) -> retry -> success (US-9). Tests grounded documented stories only (no invented stories per root `CLAUDE.md` E2E rule).

---

## Task 21: Pre-push fast lane (lefthook)

**Files:**

- Modify: `package.json`
- Modify: `lefthook.yml`
- Create: `scripts/e2e-precheck.sh`

- [ ] **Step 1:** Add `test:e2e:fast` script to `package.json`:

```json
"test:e2e:fast": "playwright test --grep '@fast' --project=chromium"
```

- [ ] **Step 2:** Create `scripts/e2e-precheck.sh` that verifies local Postgres and Redis are running (via `pg_isready` and `redis-cli ping`). Exit 1 with a helpful message if either is down.

- [ ] **Step 3:** Update `lefthook.yml` pre-push:

```yaml
pre-push:
  commands:
    format:
      run: pnpm format:check
    lint:
      run: pnpm lint
    build:
      run: pnpm --filter agentic-travel-agent-server build
    e2e-precheck:
      run: ./scripts/e2e-precheck.sh
    e2e-fast:
      run: pnpm test:e2e:fast
```

- [ ] **Step 4:** Tag the smoke test, the full `auth.spec.ts`, and `journeys/happy-path-booking.spec.ts` with `@fast`. Target combined runtime: < 30 seconds.

- [ ] **Step 5:** Commit: `feat: add pre-push e2e fast lane`

---

## Task 22: CI full E2E workflow

**Files:**

- Create: `.github/workflows/e2e.yml`
- Modify: `.github/workflows/ci.yml` (add required check dependency)

- [ ] **Step 1:** Create `.github/workflows/e2e.yml`:

```yaml
name: E2E
on: [push, pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: voyager_test
        ports: ['5432:5432']
      redis:
        image: redis:7
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter agentic-travel-agent-server run migrate
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/voyager_test
      - run: pnpm playwright install chromium
      - run: pnpm test:e2e
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/voyager_test
          REDIS_URL: redis://localhost:6379
          E2E_MOCK_TOOLS: '1'
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

- [ ] **Step 2:** Add the `e2e` job as a required check on `main` branch protection (via `gh api repos/:owner/:repo/branches/main/protection` or manually in settings).

- [ ] **Step 3:** Commit.

---

## Task 23: Nightly real-API smoke workflow

**Files:**

- Create: `.github/workflows/e2e-real-apis.yml`
- Create: `e2e/real-apis/smoke.spec.ts`

- [ ] **Step 1:** Create `e2e/real-apis/smoke.spec.ts` with 3-4 tests that hit real SerpApi, real Google Places, and real Anthropic (no `E2E_MOCK_TOOLS`). Keep the suite small: one flight search, one hotel search, one experience search, one full agent turn.

- [ ] **Step 2:** Create `.github/workflows/e2e-real-apis.yml`:

```yaml
name: E2E Real APIs (nightly)
on:
  schedule:
    - cron: '0 7 * * *' # 07:00 UTC daily
  workflow_dispatch:
jobs:
  real-api-smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm playwright install chromium
      - run: pnpm playwright test e2e/real-apis/
        env:
          SERPAPI_API_KEY: ${{ secrets.SERPAPI_API_KEY }}
          GOOGLE_PLACES_API_KEY: ${{ secrets.GOOGLE_PLACES_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      - name: Open issue on failure
        if: failure()
        run: |
          gh issue create \
            --title "real-api smoke failed $(date -u +%Y-%m-%d)" \
            --label real-api-failure \
            --body "Nightly real-api smoke failed. See workflow run $GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 3:** Commit.

---

## Task 24: Exit verification and handoff

- [ ] **Step 1:** Run `grep -rE "test\('US-[0-9]+:" e2e/ | wc -l`. Expected: 35.

- [ ] **Step 2:** Run `ls e2e/journeys/*.spec.ts | wc -l`. Expected: 3.

- [ ] **Step 3:** Run `pnpm test:e2e:fast` locally. Expected: < 30 seconds, all tests pass (except `test.fixme` ones).

- [ ] **Step 4:** Push the branch. Verify CI `e2e` workflow runs and passes.

- [ ] **Step 5:** Manually trigger `e2e-real-apis.yml` via `gh workflow run e2e-real-apis.yml`. Verify it runs successfully at least once.

- [ ] **Step 6:** Produce handoff report. Report the number of tests marked `test.fixme` and which triage IDs they map to. Those items must be fixed in Plan C.

- [ ] **Step 7:** Merge `plan/e2e-and-gates-2026-04-06` to `main`. Clean up worktree.

---

## Exit criteria

- [ ] 35 story tests exist, one per US-N, named with `US-N:` prefix.
- [ ] 3 journey tests in `e2e/journeys/`.
- [ ] All external APIs except Anthropic are mocked via `E2E_MOCK_TOOLS=1`.
- [ ] `pnpm test:e2e` runs green (or has documented `test.fixme` blockers pointing to Plan C).
- [ ] Pre-push fast lane (`pnpm test:e2e:fast`) exists and completes in < 30 seconds.
- [ ] CI `e2e` workflow runs on every push and is a required check on `main`.
- [ ] Nightly `e2e-real-apis.yml` workflow exists and has run at least once successfully.
- [ ] `lefthook.yml` pre-push includes `e2e-fast` and `e2e-precheck`.
