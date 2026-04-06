# Plan C: Voyager P0/P1 Test-First Fix Loop

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every P0 and P1 finding from the 2026-04-06 audit triage, test-first, on a single branch with one commit per fix. Merge as one PR with many commits.

**Scope:** Phase 5 Part D of the source spec. Covers 19 P0 items + 30 P1 items = 49 fixes total. This is the largest plan in the three-plan sequence.

**Source triage:** `docs/audits/2026-04-06-triage.md`

**Working branch:** single branch `fix/audit-2026-04-06-p0p1` in a worktree at `.claude/worktrees/plan-c-fixes-2026-04-06/`.

**Ordering:** P0 items first (in category priority: security -> financial -> legal -> ux -> marketing -> strategic), then P1 items. Within each severity, smallest effort first.

---

## Prerequisite: strategic decision on CRIT-01

**[CRIT-01]** "Voyager unit economics are unworkable; no booking path" requires a strategic decision before any other fix lands. The decision is product-level, not technical. The user must choose:

**Option A: Reframe as portfolio demo.** Add a disclaimer to the landing page ("This is a demonstration of an agentic AI travel planning pattern, not a commercial booking service"). Remove all pricing claims. Keep the codebase but stop pretending it is a shipping product. Much lower legal exposure. Many P0 legal items soften or disappear.

**Option B: Commit to a real booking path.** Integrate Duffel or Viator or Booking.com affiliate. Define revenue model. Ship a minimum viable booking transaction. Full P0 fix loop applies; the product becomes real.

**Option C: Mothball.** Freeze Voyager. Do not fix any P0 items. Do not deploy to public traffic. Mark it as "not currently a priority" in the README and move on.

**Stop Plan C execution at Task 1 until the user has made this decision.** The plan's scope changes significantly based on the answer. Do not guess; ask.

---

## Fix topology

- **Single branch** `fix/audit-2026-04-06-p0p1`.
- **One commit per fix.** Each commit contains both the reproducing test and the fix, per the global test-first rule in `~/.claude/CLAUDE.md`.
- **Commit messages:** `fix(<triage-id>): <description>`, e.g. `fix(SEC-01): require auth on /places/photo`.
- **Lefthook fix-commit gate** will warn (not block) on any commit that fails to include a test file. Warning mode is the default until the rule has proven stable.
- **Merge strategy:** one PR against `main` with a merge commit (not squash), titled `fix: audit 2026-04-06 P0/P1 findings`. Preserves individual fix commits in history.

---

## Order of operations (P0 first, smallest effort first)

### Group 1: Strategic decision (blocker)

- Task 1: User decision on CRIT-01 (Option A / B / C)

### Group 2: P0 financial (blast radius)

- Task 2: FIN-03 set Google Cloud billing cap on Places project (S)
- Task 3: FIN-01 set hard Anthropic monthly cap + per-user daily token counter + lower maxIterations (M, code work)
- Task 4: FIN-02 implement Redis-backed SerpApi monthly counter + graceful degrade + extend cache TTL (M)

### Group 3: P0 security

- Task 5: SEC-01 require auth on /places/photo + strict `ref` regex + clamp maxwidth + dedicated rate limit + cache (M)

### Group 4: P0 legal + marketing (copy and docs)

- Task 6: LEG-02 / MKT-02 / CRIT-03 fix FAQ Amadeus misrepresentation (S, one copy change)
- Task 7: LEG-04 / MKT-07 remove "No hallucinated prices" claim (S)
- Task 8: LEG-03 remove phantom $9 Pro plan from FAQ (S)
- Task 9: LEG-01 remove dead TOS/Privacy links from register, or publish stubs (S-M depending on CRIT-01 decision)
- Task 10: LEG-05 publish Privacy Policy stub (L if real, S if stub)
- Task 11: LEG-06 publish Terms of Service stub (L if real, S if stub)
- Task 12: LEG-07 add AI disclosure banner on chat UI (S)
- Task 13: MKT-01 rewrite hero copy (S)
- Task 14: MKT-03 add OG image + Twitter card + sitemap + robots.txt (M)
- Task 15: CRIT-03 product identity cleanup (rename to single name across codebase) (S-M)

### Group 5: P0 UX destructive action guardrails

- Task 16: UX-01 add confirmation dialog for trip delete (S, depends on Radix migration or inline AlertDialog)
- Task 17: UX-02 add cancel affordance to BookingConfirmation spinner + two-step confirm (M)

### Group 6: P1 prerequisites for Plan B

- Task 18: ENG-04 tool executor adapter seam (M, prerequisite for Plan B)

### Group 7: P1 engineering tech debt

- Task 19: ENG-03 Amadeus schema migration + code cleanup (M)
- Task 20: ENG-02 backfill tests for critical unpaired fixes (M, focus on 7ad2249, f5968be, bea33cc)
- Task 21: SEC-04 move rate limiter + activeConversations to Redis (M)

### Group 8: P1 security

- Task 22: SEC-02 upgrade @anthropic-ai/sdk + add pnpm overrides + `pnpm audit` in CI (M)
- Task 23: SEC-03 add allowlist on tool input schemas (M)

### Group 9: P1 UX + a11y + design

- Task 24: UX-03 chat error fallback -> Toast + retry + partial state (M)
- Task 25: UX-04 migrate BookingConfirmation + PreferencesWizard to Radix (M)
- Task 26: UX-05 fix "Planning..." literal destination (S)
- Task 27: UX-06 add mobile hamburger nav (M)
- Task 28: UX-07 Lighthouse a11y pass (M)
- Task 29: DES-01 type scale tokens + replace font-size literals (M)
- Task 30: DES-02 extract shared Button primitive (M)
- Task 31: DES-03 add prefers-reduced-motion global block (S)
- Task 32: DES-04 create `components/ui/` with Radix primitives (L)

### Group 10: P1 financial observability

- Task 33: FIN-04 persist token usage + fix cache_hit (M)
- Task 34: FIN-05 per-user daily token budget (M, partially done in Task 3)
- Task 35: FIN-06 lower maxIterations (S, done in Task 3)
- Task 36: FIN-07 extend SerpApi cache TTL (S, done in Task 4)

### Group 11: P1 legal + marketing backlog

- Task 37: LEG-08 cookie consent banner (M)
- Task 38: LEG-09 sign DPAs with processors (M, paperwork)
- Task 39: LEG-10 data deletion mechanism (M)
- Task 40: LEG-11 USPTO trademark search (S)
- Task 41: LEG-12 age gating on registration (S)
- Task 42: MKT-04 banned words sweep (M)
- Task 43: MKT-05 destination content rewrite (L)
- Task 44: MKT-06 monetization model decision (depends on CRIT-01)

### Group 12: P1 engineering testing coverage gap

- Task 45: ENG-01 E2E coverage gap (DEFER TO PLAN B). This task exists as a pointer; the actual work happens in Plan B.

### Group 13: Exit and merge

- Task 46: final verification + PR creation + merge

---

## Task template (applies to every fix task)

Each fix follows this exact pattern per the global test-first rule:

```
- [ ] **Step 1:** Identify the canonical file(s) that contain the bug or missing behavior.
- [ ] **Step 2:** Write a new test (unit, integration, or E2E depending on the layer) that reproduces the issue or asserts the required new behavior. Place the test next to the source file or in the appropriate spec file.
- [ ] **Step 3:** Run the test. CONFIRM IT FAILS. Save the failure output as evidence.
- [ ] **Step 4:** Write the minimal fix that makes the test pass.
- [ ] **Step 5:** Run the test again. CONFIRM IT PASSES.
- [ ] **Step 6:** Run the full verification chain:
        pnpm format:check && pnpm lint && pnpm test && pnpm build
- [ ] **Step 7:** Commit as `fix(<triage-id>): <description>`. Both the test and the fix go into the same commit.
- [ ] **Step 8:** Move to the next task.
```

No exceptions. If a fix does not have a natural test, the fix is probably misidentified as a bug; it belongs in a `chore:` or `docs:` commit instead.

---

## Exit criteria

- [ ] All 19 P0 items closed (each with a committed test-first fix).
- [ ] All 30 P1 items closed, or explicitly deferred with user approval.
- [ ] Lefthook fix-commit gate fires cleanly on every commit (warning or block mode).
- [ ] Full verification chain (`pnpm format:check && pnpm lint && pnpm test && pnpm build`) passes on every commit.
- [ ] Branch `fix/audit-2026-04-06-p0p1` opens a PR against `main` titled `fix: audit 2026-04-06 P0/P1 findings`.
- [ ] PR body lists every triage ID and its commit SHA.
- [ ] PR merges with a merge commit (not squash) so per-fix history is preserved on `main`.
- [ ] After merge, the triage file's P0 and P1 sections are all closed (annotated with the closing commit SHA).
- [ ] Plan B can now execute (ENG-04 prerequisite satisfied in Task 18).

---

## Deferred items

Items explicitly deferred by this plan:

- All P2 and P3 items from `ISSUES.md`. They remain in the rolling log and are picked up in future plans.
- The Doppelscript audit migration, which is a separate effort and already complete in commit `7e8caf35` on Doppelscript main.
- Any P0/P1 item the user explicitly deprioritizes after reviewing the triage (must be documented in the PR body).

---

## Risks

- **Scope sprawl.** 49 fixes is a lot. If midway through Plan C the triage count grows (e.g., because a P0 fix uncovers more P0 bugs), the user may choose to split the PR at a natural boundary.
- **Test-first discipline breaks down.** Under pressure, the lefthook warning is easy to ignore. The plan requires the warning to be promoted to blocking after one clean week. If the team starts ignoring warnings before that, stop and fix the process.
- **Strategic decision reversal.** If CRIT-01 option A is chosen initially (portfolio demo) but the user later decides to make Voyager real, many P1 items that were dropped will come back. Document the decision in `docs/STRATEGIC-DECISIONS.md`.
- **Plan B blocked by ENG-04.** Task 18 must land before Plan B can execute. If Task 18 reveals the tool executor refactor is larger than estimated, Plan B is delayed.
