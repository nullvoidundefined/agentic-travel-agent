# Applying Doppelscript Learnings to Voyager — Design

**Date:** 2026-04-06
**Status:** Approved by user, ready for implementation planning

## Goal

Bring Voyager up to the quality bar established in Doppelscript by:

1. Adding role-based audit infrastructure (engineering, security, design, UX, marketing, criticism).
2. Establishing a dated audit history pattern (`docs/audits/YYYY-MM-DD-<type>.md`) and applying it to both Voyager and Doppelscript.
3. Achieving 100% user story → E2E test coverage for Voyager's 35 user stories.
4. Enforcing local testing before push via pre-push fast lane plus CI full suite.
5. Fixing all P0/P1 issues surfaced by the audits, test-first.

## User intent (verbatim requirements)

- Add all role-based audit skills to Voyager.
- 100% user story coverage — every user action has an end-to-end test.
- E2E tests must actually be running.
- Test locally before pushing to prod.
- When something breaks, write a test reproducing the issue first, then fix it.
- Review Doppelscript for issues, adapt findings to Voyager.
- Apply the same dated audit-history pattern to Doppelscript itself.
- These conventions are rules that apply to all projects, not just Voyager.

## Scope decisions (brainstorming Q&A outcomes)

| #   | Question                                         | Chosen answer                                                                                       |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Q1  | Sequenced, parallel, or E2E-first?               | **Sequenced.** Audits → triage → E2E → fixes.                                                       |
| Q2  | Audit commands: copy, adapt, or rewrite?         | **Heavy rewrite** tailored to Voyager's stack and agent loop.                                       |
| Q3  | Who runs the audits?                             | **I run all 6 in parallel subagents** using isolated worktrees.                                     |
| Q4  | E2E: per-story, per-file, flow-based, or hybrid? | **Hybrid.** 1 test per user story (named `US-N: ...`) plus 3 journey tests.                         |
| Q5  | E2E external APIs: real or mocked?               | **Mocked in E2E**, separate nightly real-API smoke suite.                                           |
| Q6  | Local gate: pre-push, CI, or both?               | **Both.** Pre-push fast lane (< 30s) + CI full suite on every push.                                 |
| Q7  | Scope of bug fixes from audits?                  | **Fix P0/P1 test-first; log P2/P3 to ISSUES.md.**                                                   |
| —   | Fix branch topology?                             | **Single branch** `fix/audit-2026-04-06-p0p1`, one commit per fix, merged via PR with merge commit. |
| —   | Separate E2E Anthropic key?                      | **No.** Reuse the existing production key; revisit if billing becomes noticeable.                   |
| —   | Doppelscript audit migration?                    | **Out of scope for this effort.** Tracked as its own separate spec.                                 |

## Global rules captured

The following were written to `~/.claude/CLAUDE.md` as user-level global rules during design (they apply to every project, not just Voyager):

1. Audit outputs live in `docs/audits/YYYY-MM-DD-<type>.md` — never overwriting single files at repo root.
2. Migrations of existing audit files use original git-history dates.
3. Audit findings are always triaged by severity; P0/P1 get fixed test-first, P2/P3 go to `ISSUES.md`.
4. Test-first bug fixing is mandatory: failing test → fix → passing test → full verification chain → commit.
5. Every user story must have at least one E2E test; prefer the hybrid structure (per-story + a few journey tests).
6. E2E tests mock external APIs; a separate nightly suite exercises real APIs.
7. Pre-push fast lane (< 30s) plus CI full suite, both required.
8. Never deploy to "see if it works" — reproduce locally first.
9. Fix root causes; never bypass safety checks (`--no-verify`, disabling lint rules) to silence symptoms.

Layer-specific convention files (`CLAUDE-BACKEND.md`, `CLAUDE-FRONTEND.md`, `CLAUDE-DATABASE.md`, `CLAUDE-STYLING.md`, `CLOUD-DEPLOYMENT.md`) and `KNOWN-ISSUES.md` were copied from `templates/.claude/` and `production/ISSUES-04-05-2026.md` into `~/.claude/` as on-demand references. The global `CLAUDE.md` instructs Claude to read them only when the current task touches the matching layer, to avoid context bloat.

## Architecture — 5 phases (sequenced)

```
Phase 1: Create Voyager audit commands (Voyager-tailored)
Phase 2: Run Voyager audits in parallel (6 subagents, worktree isolation)
Phase 3: Triage → docs/audits/2026-04-06-triage.md + ISSUES.md updates
Phase 4: E2E coverage (35 story tests + 3 journey tests, mocked APIs)
Phase 5: Test gates + test-first P0/P1 fixes
```

Each phase produces committed artifacts and has explicit exit criteria. The next phase does not start until the prior is complete.

**Out of scope (separate effort):** Standardizing Doppelscript's existing audit files into the dated `docs/audits/` pattern. This is tracked as its own design and will not be executed as part of this Voyager effort.

---

## Phase 1 — Voyager audit infrastructure

**Deliverable:** 6 Voyager-tailored audit slash-commands committed to `main`.

**Files created:**

```
voyager/.claude/commands/
├── audit-engineering.md
├── audit-security.md
├── audit-design.md
├── audit-ux.md
├── audit-marketing.md
└── audit-criticism.md
```

**Each command contains:**

1. Persona sentence (role, years of experience, domains of expertise).
2. Instruction: "Read the Voyager codebase — `server/`, `web-client/`, `packages/`, `Dockerfile.server`, `railway.toml`, the agent loop in `server/src/services/agent.service.ts`, tool definitions, SerpApi / Google Places clients, convention files in `.claude/bottomlessmargaritas/`, `docs/FULL_APPLICATION_SPEC.md`, and `docs/USER_STORIES.md`."
3. Instruction: "Generate `docs/audits/YYYY-MM-DD-<type>.md` (use current date) with the sections listed below."
4. Section list (specific to each audit type — see adaptations below).
5. Instruction: "Commit to the current branch. Report back with a summary of findings."
6. Closing: "Be specific. Reference actual files, functions, and line numbers. Don't be generic."

**Voyager-specific adaptations:**

- **audit-engineering.md** — Adds sections for _Agent Loop Correctness_ (tool-call budget enforcement, max-15 safety limit, malformed tool response handling, reasoning-between-calls integrity), _External API Integration_ (SerpApi caching and rate-limit handling, Google Places quota management), _Monorepo hygiene_ (pnpm workspaces, shared types between server/web-client), _Docker & Railway build_ (Dockerfile.server, railway.toml correctness). Removes generic microservices language.
- **audit-security.md** — Focus on: Anthropic API key handling in agent loop (no leakage through tool results), SerpApi/Places key rotation, CORS config for Vercel preview URLs, Supabase RLS on trip data, CSRF pattern (verify which variant — header-based or cookie-based), prompt injection surface area (user messages flowing through the agent loop into third-party API queries).
- **audit-ux.md** — Conversational-agent-specific: turn latency perception, loading states during tool calls, tool call transparency (can users see what the agent is doing?), error recovery mid-conversation, how users iterate on itineraries, empty-state and cold-start UX, reduced-motion compliance.
- **audit-design.md** — Visual system review of home / explore / destination / trip pages. Hero carousels, destination cards, itinerary layout, chat UI, typography scale, color system, responsive breakpoints, alt text on images.
- **audit-marketing.md** — Landing page messaging, "agentic" vs "AI travel agent" positioning, CTA flow, trust signals, competitive differentiation from Kayak / Expedia / ChatGPT.
- **audit-criticism.md** — Devil's advocate. Why would Voyager fail? SerpApi quota at scale, Claude cost per trip plan, real-bookings-vs-research-only positioning, moat questions, dead Amadeus references in docs/schema/tests.

**Exit criteria:**

- All 6 command files exist in `voyager/.claude/commands/`.
- Each file follows the structure above.
- Each file references `docs/audits/YYYY-MM-DD-<type>.md`.
- A single commit: `feat: add Voyager-tailored audit slash-commands`.

---

## Phase 2 — Run Voyager audits in parallel

**Deliverable:** 6 dated audit files committed to `main`.

**Execution model:** One `Agent` tool invocation per audit, dispatched in a single message for true parallelism. Each agent runs in an isolated worktree (`isolation: "worktree"`) so concurrent commits do not conflict.

```
Agent 1 → engineering audit → docs/audits/2026-04-06-engineering.md
Agent 2 → security audit    → docs/audits/2026-04-06-security.md
Agent 3 → design audit      → docs/audits/2026-04-06-design.md
Agent 4 → ux audit          → docs/audits/2026-04-06-ux.md
Agent 5 → marketing audit   → docs/audits/2026-04-06-marketing.md
Agent 6 → criticism audit   → docs/audits/2026-04-06-criticism.md
```

**Each agent prompt** contains the full text of its audit command (not just a slash-command reference) so the agent can execute deterministically without depending on slash-command discovery.

**Output consolidation:**

- Each agent writes its audit file in its worktree and returns the file contents (or the worktree path) to the parent session.
- Parent session collects all 6 files and commits them to real `main` in a single commit: `audit: 2026-04-06 run (engineering, security, design, ux, marketing, criticism)`.

**Exit criteria:**

- `docs/audits/` contains 6 files dated 2026-04-06, one per audit type.
- Each audit file follows the section structure defined in its command.
- Each audit references specific files, functions, and line numbers (not generic).
- A single commit on `main` includes all 6 files.

---

## Phase 3 — Triage

**Deliverable:** `docs/audits/2026-04-06-triage.md` committed to `main`, plus `ISSUES.md` updated with P2/P3 findings.

**Actions:**

1. Read all 6 audit files from Phase 2.
2. For each finding, assign:
   - **Severity:** P0 (broken / security hole / data loss) · P1 (critical path degraded / high-risk) · P2 (quality / UX friction) · P3 (nice-to-have / cosmetic).
   - **Effort:** S (< 1 hr) · M (1–4 hr) · L (> 4 hr).
   - **Category:** bug / security / UX / design / marketing / tech-debt.
   - **Source:** which audit surfaced it (audit file + section).
3. Write `docs/audits/2026-04-06-triage.md` containing:
   - Summary: total findings, split by severity.
   - P0 section: full fix queue.
   - P1 section: full fix queue.
   - Pointer to `ISSUES.md` for P2/P3.
4. Append P2/P3 findings to `ISSUES.md` at repo root (create the file if missing; follow the same rolling-log structure Doppelscript uses).
5. Commit: `docs: triage 2026-04-06 audit findings (N P0, M P1, K P2, J P3)`.

**Triage file entry format:**

```markdown
### [ENG-01] Agent loop doesn't enforce 15-call budget

- Source: docs/audits/2026-04-06-engineering.md §Agent Loop Correctness
- Severity: P0 · Effort: S · Category: bug
- Repro: ...
- Fix approach: ...
```

**Exit criteria:**

- `docs/audits/2026-04-06-triage.md` exists with P0 and P1 sections.
- `ISSUES.md` at repo root contains P2/P3 findings.
- Every finding in the audit files appears in either the triage file or `ISSUES.md`.

---

## Phase 4 — E2E coverage

**Deliverable:** Playwright E2E suite covering 100% of the 35 user stories in `docs/USER_STORIES.md`, plus 3 journey tests, with mocked external APIs.

**Pre-work:** Verify `docs/USER_STORIES.md` is still accurate against the current implementation. Flag drift items for triage — do not silently rewrite stories to match code. The spec is the source of truth; if code diverges, that's an audit finding.

**File layout (grouped by the actual sections in `docs/USER_STORIES.md`):**

```
e2e/
├── fixtures/
│   ├── mock-serpapi.ts            — fake flight + hotel responses (happy + edge cases)
│   ├── mock-google-places.ts      — fake experience + restaurant results
│   └── test-users.ts              — seeded user factories
├── helpers/
│   ├── auth.ts                    — login / register / logout page objects
│   ├── chat.ts                    — send message, assert tool-call indicator, read response
│   └── trip.ts                    — create / load / save trip helpers
├── public-pages.spec.ts           — US-1 to US-7   (home, browse, filter, detail, start-trip CTA, FAQ, nav)
├── auth.spec.ts                   — US-8 to US-12  (register, login, failed login, logout, protected route)
├── trip-management.spec.ts        — US-13 to US-17 (view trips, create, detail, delete, trip cards)
├── chat-booking-flow.spec.ts      — US-18 to US-24 (welcome, form, message, response, tile cards, select tile, quick reply)
├── checkout.spec.ts               — US-25 to US-28 (modal, breakdown, confirm, locked state)
├── preferences.spec.ts            — US-29 to US-33 (wizard, wizard nav, edit, badge, view)
├── account.spec.ts                — US-34, US-35   (account details, preference status)
└── journeys/
    ├── happy-path-booking.spec.ts    — discover → register → wizard → create trip → chat → select tiles → checkout → confirm
    ├── returning-user-iterates.spec.ts — login → view trips → open trip → follow-up message → select tile → save
    └── failure-path.spec.ts          — protected route redirect (US-12) → failed login (US-10) → retry → success (US-9)
```

**Grouping note:** The area boundaries above exactly match the `## Section` headings in `docs/USER_STORIES.md` (Public Pages, Authentication, Trip Management, Chat & Booking Flow, Checkout & Booking Confirmation, User Preferences, Account). There is no "error-states" spec file because no error-state user stories exist in the documented set — error paths are tested within each story's individual test case (e.g., US-10 "Failed login" lives in `auth.spec.ts`) and in the `failure-path` journey.

**Total test count:** 35 story tests (one per user story) + 3 journey tests = 38 tests.

**No `mock-amadeus.ts`.** Amadeus is referenced in `docs/FULL_APPLICATION_SPEC.md`, `server/src/schemas/trips.ts` (nullable `amadeus_offer_id` / `amadeus_hotel_id` columns), and a handful of tests as a label string, but there is no actual Amadeus client in `server/src/`. This divergence between spec and implementation is itself a triage item.

**Test naming:**

```typescript
test.describe('Public pages', () => {
  test('US-1: home page discovery', async ({ page }) => { ... });
  test('US-2: browse destinations', async ({ page }) => { ... });
});
```

**Mocking strategy — two layers:**

1. **HTTP layer (Playwright `page.route`)** — safety net for any direct browser → third-party call.
2. **Server-side tool executor fixture** — the real mock layer. When `E2E_MOCK_TOOLS=1` is set in the server's environment, the tool executor returns fixture data instead of calling SerpApi / Google Places.
   - Playwright's `webServer` config sets `E2E_MOCK_TOOLS=1` when booting the server for E2E runs.
   - The real Anthropic API is still called. Claude reasons against real tool-use prompting with mocked tool results. This tests the agent loop's actual decision-making, not just mocked-away reasoning.
   - If the server's tool executor does not currently support adapter injection, Phase 1's engineering audit will flag it and Phase 5 will add it as a prerequisite P1 fix. Estimated cost per full E2E run: ~$0.50–$2.00 in Anthropic tokens, zero SerpApi quota.

**Anthropic API cost handling:**

- Reuses the existing production `ANTHROPIC_API_KEY` for E2E runs. (Decision: avoid the operational overhead of a separate E2E key for now; revisit if E2E-driven cost becomes noticeable in billing.)
- Key is already stored as a GitHub Actions secret and in local `.env` files.
- If billing separation becomes desirable later, the swap is a single env-var name change across Playwright's `webServer` config, `lefthook.yml`, and the CI workflow — small effort, deferred until there's a reason.

**Exit criteria (Phase 4):**

- One `test()` per user story, named `US-N: <story title>`.
- 3 journey tests in `e2e/journeys/`.
- All external APIs except Anthropic are mocked via the `E2E_MOCK_TOOLS=1` path.
- Running `pnpm test:e2e` executes the full suite against a locally booted server.
- Suite may be red at this point — Phase 5 is where we fix the underlying bugs that make it green.

---

## Phase 5 — Test gates + test-first P0/P1 fixes

**Deliverable:** Pre-push fast lane, CI full suite, nightly real-API smoke workflow, all P0/P1 triage items closed test-first, full E2E suite green on `main`.

### Part A — Pre-push fast lane (lefthook)

1. Add script to `package.json`:
   ```json
   "test:e2e:fast": "playwright test --grep '@fast' --project=chromium"
   ```
2. Tag tests with `@fast` in their name:
   - The smoke test.
   - All of `auth.spec.ts` (US-5, US-6, US-7).
   - `e2e/journeys/happy-path-booking.spec.ts`.
     Target combined runtime: < 30 seconds.
3. Update `lefthook.yml`:
   ```yaml
   pre-push:
     parallel: true
     commands:
       format:
         run: pnpm format:check
       lint:
         run: pnpm lint
       build:
         run: pnpm build
       e2e-fast:
         run: pnpm test:e2e:fast
   ```
4. Add `scripts/e2e-precheck.sh` that verifies local Postgres and Redis are running before the fast lane executes, exiting with a clear error if not.

### Part B — CI full suite (GitHub Actions)

1. New workflow `.github/workflows/e2e.yml`:
   - Triggers: `push`, `pull_request`.
   - Services: Postgres 16, Redis 7.
   - Steps: checkout → pnpm + node setup → `pnpm install` → `pnpm db:migrate` → `pnpm playwright install chromium` → `pnpm test:e2e` → upload `playwright-report/` on failure.
2. Add the `e2e` job as a required check on `main` branch protection.

### Part C — Nightly real-API smoke

1. New workflow `.github/workflows/e2e-real-apis.yml`:
   - Triggers: `schedule: cron '0 7 * * *'` (07:00 UTC daily), `workflow_dispatch`.
   - Runs a small `e2e/real-apis/` suite (3–4 tests) against real SerpApi + Google Places + Anthropic.
   - Secrets: `SERPAPI_KEY_PROD`, `GOOGLE_PLACES_KEY_PROD`, `ANTHROPIC_API_KEY_PROD`.
   - On failure: opens a GitHub issue tagged `real-api-failure`.
   - Does not block PRs or pushes.

### Part D — P0/P1 fix loop (test-first, strict)

All P0/P1 fixes land on a **single branch** `fix/audit-2026-04-06-p0p1`, with **one commit per fix**. The branch is then merged to `main` as one PR containing many commits (preserving individual fix history). Fixes are processed P0 before P1, and within each severity by effort (S → M → L).

For every P0 and P1 item in `docs/audits/2026-04-06-triage.md`:

1. On the `fix/audit-2026-04-06-p0p1` branch, write a test reproducing the issue at the appropriate layer (unit, integration, or E2E). **Run it. Confirm it fails.**
2. Write the minimal fix.
3. Run the test again. **Confirm it passes.**
4. Run the full verification chain:
   `pnpm format:check && pnpm lint && pnpm test && pnpm test:e2e:fast && pnpm build`
5. Commit with message `fix(<triage-id>): <description>` — one commit containing both the new test and the fix.
6. Move to the next triage item; repeat.

After all P0/P1 items are committed on the branch, open one PR against `main` titled `fix: audit 2026-04-06 P0/P1 findings`. The PR body lists each triage ID and commit SHA. Merge with a merge commit (not squash) so individual fix commits remain in history.

No skipping step 1. No deploying to production to check whether a fix works. No `--no-verify`.

### Exit criteria (Phase 5)

- All P0 triage items closed, each with a committed test-first fix.
- All P1 triage items closed, each with a committed test-first fix.
- Full E2E suite (35 story tests + 3 journey tests) green on `main`.
- Pre-push fast lane verified by running `git push` on a test branch and observing lefthook execute `e2e-fast`.
- CI `e2e` workflow runs on every push and is a required check on `main`.
- Nightly `e2e-real-apis` workflow exists and has executed at least one successful run.
- All P2/P3 items are in `ISSUES.md` with severity, effort, category, and source tags.

---

## Risks and mitigations

| Risk                                                             | Mitigation                                                                                                                                                                                                |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audit subagents produce generic, template-feeling reports        | Each command's closing line explicitly demands specific files, functions, line numbers. If a report is generic, it is rejected and rerun with stricter wording.                                           |
| Amadeus references in docs/schema surface as hidden dependencies | Phase 4 drops Amadeus mocks entirely (they're unused). Removing Amadeus references from docs / schema / tests is a separate triage item processed in Phase 5 if it lands in P0/P1.                        |
| Anthropic API costs during E2E exceed expectations               | Playwright's `--project=chromium` limits runs to a single browser; `@fast`-tagged subset reduces pre-push cost to a handful of turns; monitor billing; separate E2E key remains an option if costs spike. |
| `USER_STORIES.md` is out of date against current implementation  | Phase 4 pre-work verifies the file. Drift is flagged for triage, not silently corrected. The grouping boundaries in this spec match the current `## Section` headings in the file (verified 2026-04-06).  |
| Tool executor does not currently support adapter injection       | Phase 1 engineering audit flags this; it becomes a P1 prerequisite fix in Phase 5 before E2E gates can go live.                                                                                           |
| Pre-push fast lane pushes 30s over budget                        | If runtime exceeds 45s consistently, drop the journey test from the fast lane and rely on CI to catch journey failures. The fast lane exists to catch gross breakage, not every regression.               |
| Single fix branch grows too large to review                      | If the P0/P1 fix count exceeds ~20 commits, consider splitting into two PRs (P0s merged first, P1s merged second). Decision point lives at the end of Phase 3 when the triage count is known.             |

## Non-goals

- Rewriting the agent loop. Audit findings may recommend it; if so, they go through the triage + P0/P1 process like anything else. This design does not pre-commit to rewrites.
- Migrating Voyager off SerpApi onto Amadeus (or vice versa). That is a product decision outside this effort.
- Adding new user stories. This design tests existing stories; it does not invent new features.
- Fixing P2/P3 findings in this effort. They are logged and deferred.
- Changing the production deployment pipeline (Railway / Vercel). Only the test gates change.

## Success definition

This effort is complete when all five phases' exit criteria are met and a push to `main` runs the full chain — pre-push fast lane, CI full suite — with green results, and a nightly real-API smoke has executed successfully at least once.
