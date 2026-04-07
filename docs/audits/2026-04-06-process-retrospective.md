# Process Retrospective: Voyager

**Date:** 2026-04-06
**History scanned:** 15bc6537 (Initial scaffold, 2026-03-24) to 8cf36d2b (docs: plan A, 2026-04-06), 246 commits in the Voyager era (commits since 2026-03-24; 292 total counting pre-scaffold history).
**Time window:** 2026-03-24 to 2026-04-06 (13 days).
**Fix commits analyzed:** 51. **Reverts:** 1.
**Merge commits / PRs:** 0 (fully trunk-based, direct-to-main; no `Merge pull request` subjects exist in the Voyager era).

---

## 1. Top 10 painful bug clusters

Ranked by a mix of chain length, re-fix signal, and production blast radius.

### 1. destinations.json / driving-requirements.json in the Docker build (three fixes, production crash)

- Chain: `3f8a2fb3` (2026-04-02 23:20 — include shared-types in Docker build) → `9f08897b` (2026-04-02 23:37 — inline driving-requirements JSON to avoid readFileSync path issue in Docker) → `90470b14` (2026-04-04 18:21 — fs.readFileSync for destinations.json) → `bea33cc5` (2026-04-04 19:22 — Railway crash, copy JSON to dist).
- Root cause: `tsc` does not copy JSON assets to `dist/`, and the Dockerfile did not `COPY` them either. The team learned this twice (once for driving-requirements, which was resolved by inlining the data into a `.ts` file, and again two days later for destinations.json, which crashed prod).
- Each attempt taught: (a) inlining to TS dodges the problem; (b) fs.readFileSync works locally because source tree sits next to the binary; (c) Docker layering hides the loss; (d) only a production crash (`bea33cc5`) surfaced both the build-script and Dockerfile gaps at once. Ian's `CLAUDE.md` explicitly bans "deploy to see if it works"; `90470b14` → `bea33cc5` is a 1-hour deploy-and-crash-and-patch cycle, a textbook violation.

### 2. Welcome message + TripDetailsForm rendering (three fixes in under 25 minutes)

- Chain: `69b0eaf8` (07:56 — show welcome message with form) → `de36b802` (08:08 — welcome is text-only, form appears after user responds) → `f56b4417` (08:20 — form shows only missing fields).
- Every fix touched `server/src/handlers/chat/chat.ts` and `chat.test.ts`. The product intent flipped twice in 24 minutes. The cluster is a symptom of shipping a UX decision without first writing it down as a user story with concrete acceptance criteria.
- What the final fix taught: "show the form" is underspecified. The real question is "which fields, under which states, with what previous user response."

### 3. The ChatBox/NodeRenderer rendering churn (nine consecutive fix commits in ~5 hours)

- Chain (oldest → newest): `183eb289`, `0c043b97`, `b64de50f`, `2523eeda`, `09bf8eaa` (debug: added console.logs), `e62bc046`, `1eb12aca`, `6ecef94e`, `9e2eab7d`.
- Every commit touched `web-client/src/components/ChatBox/*`. A `debug:` commit (`09bf8eaa`) landed directly on main adding `console.log` for diagnostics, then followed by more fixes. That is production-as-debugger.
- What each fix attempted: persist tool cards, suppress text duplication, render virtualized empty state, fix card click callbacks, wire QuickReplyChips. Each patched one symptom without a unified data-model pass. Final (`9e2eab7d`) still only addressed chip placement.

### 4. Batched "B-numbered" bug fixes (four commits, 23 unrelated bugs)

- Chain: `15f86be5` (B4-B7) → `5ab42753` (B1, B3, B8, B9) → `8f7bae5b` (B10-B13) → `047679bc` (B15-B23).
- These are bundled fixes listed in `docs/BUGS.md`. Only one (B12) explicitly mentions "4 new tests." Cross-cutting bugs land together with no test-per-bug traceability. B1 = SSE streaming. B8 = data model consolidation. B9 = mobile Safari cookie config. These are shipped in a single commit and share no review surface.
- Lesson: batching unrelated fixes removes the ability to revert a single regression without dragging eight other unrelated changes with it.

### 5. Chat handler race conditions (two fix commits within 6 minutes)

- Chain: `e6f452c4` (07:41 — auto-save form data when user sends chat message) → `7ad22496` (07:47 — add conversation lock to prevent concurrent agent loops) → `be8d19b8` (07:50 — date validation, conversation truncation, clearer tool error messages).
- Three consecutive commits touching the chat handler in under 10 minutes. The conversation lock (`7ad22496`) came after discovering concurrent agent loops existed, which is an architectural gap that should have been surfaced during the original chat handler design, not patched in 6 minutes while firefighting.

### 6. CSRF add-then-revert in 21 minutes (classic feature whiplash)

- Chain: `54ef202c` (22:42 — add CSRF token handling to frontend) → `b0c45799` (23:03 — revert, this app uses X-Requested-With only).
- Body of the revert: "The token fetch was hitting a nonexistent endpoint." The fix was shipped without running the auth flow end-to-end. This matches the "CSRF pattern differences between apps" warning in `/Users/iangreenough/Desktop/code/personal/.claude/CLAUDE.md`, which was added because this class of mistake has happened on multiple apps.

### 7. Eval harness self-fixes in 4 minutes (0f4afdbc → 44d660e8)

- Chain: `0f4afdbc` (15:54 — swap customer agent roles, add empty response handling, prefill judge JSON) → `44d660e8` (15:58 — contextual fallback for empty customer responses, add persona caching).
- Eval framework shipped, first run found the customer-agent role swap was wrong AND the persona cache was missing, in 4 minutes. The eval suite itself was not dogfooded before commit; the run produced the bugs.

### 8. Test harness / vi.mock / SSL / Anthropic-lazy-init (four fixes across two days)

- Chain: `75c2bd5b` (vi.mock hoisting) → `b164a9ed` (disable SSL in test env) → `182b60b1` (update test assertions) → `cd7f3ddad` (lazy-init Anthropic clients, load server .env, set NODE_ENV=test).
- Every one of these patches infrastructure that should have been right from the start of the test suite. The `cd7f3ddad` commit alone fixes three separate test-environment sins in one message.

### 9. Pre-push / lint / format hygiene fixes (four commits)

- `30eccae4` (exclude e2e/scripts/config from ESLint to fix pre-push hook), `798cd1bc` (exclude .claude/ from Prettier — Node 22 vs Node 25 diff), `047ad4aa` (style: format all files), `5441c42e` (style: format all files + fix unused disable directive), `91018165` (style: format all files with prettier).
- Three independent "style: format all files" commits is an anti-pattern: it means the pre-commit hook was silently bypassed or uninstalled multiple times. `27e7c4bc` (test: intentionally bad formatting) + `823e2ec1` (revert) confirms the hook was being probed manually rather than trusted.

### 10. "feat: add frontend test files and vitest config (missed in prior commit)" — `2890a276`

- Single-commit cluster, but high-signal. The immediately prior commit (`e9c9bc11`) claimed to add frontend component tests but omitted the actual `.test.tsx` files and `vitest.config.ts`. This is a `git add .` gap. The compensating commit is a self-report of the failure mode.

---

## 2. Bug fix discipline

### Violation rate

- 51 commits match `fix:` / `fix(` / `bug:` / `bugfix:` / `hotfix:` in the Voyager era.
- 35 of them add zero test files (`*.test.*`, `*.spec.*`, `e2e/**`, `__tests__/**`, `test/**`).
- **Violation rate: 35 / 51 = 68.6%** against the canonical rule in `~/.claude/CLAUDE.md` ("Test-first bug fixing" → "a commit whose subject starts with `fix:` ... MUST include at least one test file in the same commit").

### Top 10 violators (prioritized by severity × obvious-test-was-possible)

| #   | SHA        | Subject                                                                  | Why this matters                                                                                                          |
| --- | ---------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | `bea33cc5` | fix: Railway crash — copy JSON to dist, fix rate limiter IPv6 validation | Production crash. A build-smoke test asserting `dist/` contains `destinations.json` would have caught it; none was added. |
| 2   | `90470b14` | fix: use fs.readFileSync for destinations JSON                           | Same root as 1; a test on `loadDestinations()` with path resolution would have caught both. No test added.                |
| 3   | `6968de4d` | fix: change default server port from 3000 to 3001                        | Server-config regression; a test on `getConfig().port` was trivial. None added.                                           |
| 4   | `7ad22496` | fix: add conversation lock to prevent concurrent agent loops             | Concurrency fix. No integration test that fires two simultaneous requests was added.                                      |
| 5   | `f5968bee` | fix: add detectSchemaVersion and migrateV0ToV1 to normalizePreferences   | Schema migration; the exact kind of pure-function logic where test-first should be automatic. No test added.              |
| 6   | `54ef202c` | fix: add CSRF token handling to frontend API client                      | Reverted within 21 minutes. An end-to-end auth test would have caught the endpoint-doesn't-exist mistake before shipping. |
| 7   | `b0c45799` | fix: revert CSRF token handling                                          | Same chain as 6; revert shipped with no test to prevent re-introduction.                                                  |
| 8   | `06080ed0` | fix: refresh trip data after every tool result                           | A React-Query invalidation behavior change with no component test.                                                        |
| 9   | `e62bc046` | fix: persist tool result cards after stream ends, stop text duplication  | SSE stream-end state bug. A streaming mock test was feasible; none added.                                                 |
| 10  | `5ab42753` | fix: resolve bugs B1, B3, B8, B9                                         | Four unrelated bugs in one commit; at minimum four tests were possible; none added.                                       |

### Which violations are justified (pure-docs-mislabeled-as-fix)?

Reviewed the 35 violators; **justifiable** (the diff was genuinely a non-code prompt/docs/config change that could not be unit-tested):

- `ec73bf53` reformat quiz.md — pure content reformat; should have been `docs:`.
- `a085bf28` make header logo and compass both coral/orange — pure CSS; should have been `style:`.
- `16be042b` proactive search rule + wider mock hotel price range — prompt + mock data tweak; arguably `chore:` or `feat:`.
- `d3b8859e` add prompt rules to avoid redundant questions — pure prompt change; `chore:`.
- `30eccae4` exclude e2e/scripts/config files from ESLint — CI config; `chore:`.
- `798cd1bc` exclude .claude/ from Prettier — CI config; `chore:`.
- `d025abc7` add @google-cloud/secret-manager to server deps — dep bump; `chore:`.
- `3f8a2fb3` include shared-types in Docker build — Dockerfile; arguably a build smoke test should exist, but no unit test is possible.

**The remaining 27 violators (77% of the violating set) are genuine logic-change bug fixes that the canonical rule says must ship with a test.** The rule exists; the repo has a 77% real-violation rate against it.

The canonical rule, reproduced verbatim for reference, is: _"a commit whose subject starts with `fix:` / `fix(` / `bug:` / `bugfix:` / `hotfix:` MUST include at least one test file in the same commit ... Commits that violate this rule are evidence of optimism-driven debugging."_ (`~/.claude/CLAUDE.md`, "Test-first bug fixing").

---

## 3. Learning moments

Phrase clusters from `git log` commit bodies.

### Cluster A: "instead of" (12+ matches — a chronic sign of "we learned X was wrong")

- `847bcb73` "getRedis() returns null when REDIS_URL is unset instead of throwing."
- `f5968bee` "instead of the new detectSchemaVersion helper. This caused data with..."
- `44d660e8` "fallback message instead of sending empty string to chat handler"
- `0a0ab470` "TripDetailsForm sends structured data to PUT /trips/:id instead of natural language"
- `b8407d0a` "Fix MockChatBox to use static height instead of content-based sizing"
- `2c61edbb` "Use fixed height instead of max-height for ChatBox"
- ...and 6 more.
- **Lesson:** every "instead of" is a past decision the team is re-deciding. A short pre-implementation sketch (15-line design note naming the chosen approach _and the rejected alternative_) would prevent at least half of these.

### Cluster B: "missed" / "missing from the prior commit" (3+ matches)

- `2890a276` "feat: add frontend test files and vitest config (missed in prior commit)" — bodies: "Adds the actual test files and vitest configuration that were missed from the prior commit's git add."
- `d025abc7` body implies missing dep from lockfile.
- `bea33cc5` "destinations.json missing from dist/ — tsc doesn't copy JSON files."
- **Lesson:** `git add .`/`git add -A` without `git status` verification is actively failing. Three separate incidents in a 13-day window.

### Cluster C: "This caused" / "was failing because" (3+ matches)

- `54ef202c` "Login and all state-changing requests were failing with 403 because the frontend wasn't fetching or sending CSRF tokens."
- `bea33cc5` "destinations.json missing from dist/ — tsc doesn't copy JSON files. Fixed by adding cp to build script..."
- `847bcb73` "Redis cache failures no longer crash requests" implying they did before.
- `b0c45799` "The token fetch was hitting a nonexistent endpoint."
- **Lesson:** each of these is a production surprise. None was caught by a smoke test.

### Cluster D: "optimism-driven" / "No optimism-driven development" (explicit self-rebuke)

- `27e41de2` body: _"Codifies the test-first bug fix process: reproduce failure in a test, fix code, verify test passes, run full chain, then deploy. No optimism-driven development. Also documents lefthook hook verification."_
- Committed at 2026-04-03 12:04. **The 68.6% bug-fix-without-test violation rate is across commits both before AND after this self-codification.** The rule was codified, acknowledged, and then violated at the same rate.

---

## 4. Audit-finding lifecycle table

No pre-existing audit reports or triage files exist in the repository. `docs/audits/` does not exist prior to this report. `ISSUES.md` does not exist. `docs/BUGS.md` exists and uses its own B-numbered scheme (B1–B23), which is the closest analogue to a triage log.

Lifecycle table based on BUGS.md IDs:

| ID  | severity (inferred)                | source  | days-to-fix | resolution SHA | status |
| --- | ---------------------------------- | ------- | ----------- | -------------- | ------ |
| B1  | P1 (SSE broken)                    | BUGS.md | <1          | `5ab42753`     | closed |
| B2  | P2 (prompt quality)                | BUGS.md | n/a         | (none)         | open   |
| B3  | P1 (UX blank-gap)                  | BUGS.md | <1          | `5ab42753`     | closed |
| B4  | P2 (ESLint config)                 | BUGS.md | <1          | `15f86be5`     | closed |
| B5  | P1 (wrong budget math)             | BUGS.md | <1          | `15f86be5`     | closed |
| B6  | P2 (missing car-rental join)       | BUGS.md | <1          | `15f86be5`     | closed |
| B7  | P3 (currency formatting)           | BUGS.md | <1          | `15f86be5`     | closed |
| B8  | P2 (duplicated city data)          | BUGS.md | <1          | `5ab42753`     | closed |
| B9  | P1 (mobile Safari auth)            | BUGS.md | <1          | `5ab42753`     | closed |
| B10 | P2 (hero layout)                   | BUGS.md | <1          | `8f7bae5b`     | closed |
| B11 | P2 (responsive images)             | BUGS.md | <1          | `8f7bae5b`     | closed |
| B12 | P1 (stale metadata)                | BUGS.md | <1          | `8f7bae5b`     | closed |
| B13 | P1 (ignores explicit selections)   | BUGS.md | <1          | `8f7bae5b`     | closed |
| B14 | P0 (tile selections don't persist) | BUGS.md | n/a         | (none visible) | open   |
| B15 | P3 (logo)                          | BUGS.md | <1          | `047679bc`     | closed |
| B16 | P2 (click target)                  | BUGS.md | <1          | `047679bc`     | closed |
| B17 | P3 (border radius)                 | BUGS.md | <1          | `047679bc`     | closed |
| B18 | P2 (section order)                 | BUGS.md | <1          | `047679bc`     | closed |
| B19 | P3 (gap spacing)                   | BUGS.md | <1          | `047679bc`     | closed |
| B20 | P2 (duplicate confirm buttons)     | BUGS.md | <1          | `047679bc`     | closed |
| B21 | P1 (hotels missing prices)         | BUGS.md | <1          | `047679bc`     | closed |
| B22 | P0 (NaN over-budget)               | BUGS.md | <1          | `047679bc`     | closed |
| B23 | P2 (missing search bar)            | BUGS.md | <1          | `047679bc`     | closed |

**Observations:**

- B14 and B2 are explicitly listed under "Open" in `docs/BUGS.md` at the time of this audit. B14 is P0 (data persistence broken). That is a flagrant open P0 in a repo claiming to enter production.
- Of the 21 resolved bugs, 4 P3-cosmetic findings (B15, B17, B19, and arguably B7) were fixed in the same effort as a P0 (B22 NaN) inside `047679bc`. The canonical rule in `~/.claude/CLAUDE.md` — _"Never fix P2/P3 items in the same effort as the audit run unless explicitly asked"_ — is violated here: cosmetics and P0s were batched together.
- There is no severity or effort tagging on any of the B-numbered bugs. BUGS.md uses a flat list with no triage.

---

## 5. Process metrics

- **Total commits scanned:** 246 (Voyager era only; 292 including pre-scaffold).
- **Total PRs merged:** 0. The repo is fully trunk-based. `git log --merges` returns no merge commits. There is no branch-based review flow.
- **Mean PR cycle time:** n/a (no PRs).
- **Fix commits:** 51 (20.7% of all Voyager-era commits are `fix:` commits).
- **Feat commits:** 92 (37.4%).
- **Style-only commits:** 3 explicit "style: format all files with prettier" commits (`047ad4aa`, `5441c42e`, `91018165`). These are drift-correction commits indicating the pre-commit hook was not enforcing formatting reliably.
- **Reverts:** 1 (`823e2ec1` reverts the deliberate hook-probe `27e7c4bc`).
- **Co-Author:** ~95% of commits co-author Claude Opus 4.6 (1M) or Sonnet 4.6, confirming these commits are AI-generated and subject to AI-review patterns.
- **Commits made within 1 hour of a deploy-shaped commit (Railway/Vercel/Dockerfile-touching or prod crash):**
  - `bea33cc5` (Railway crash fix) is 61 minutes after `90470b14` (prior JSON fix). 2-commit deploy-and-crash cycle.
  - `3f8a2fb3` (Docker build) is 17 minutes after `9f08897b` (inline driving-requirements). 2-commit Docker cycle.
  - `b0c45799` (revert CSRF) is 21 minutes after `54ef202c` (add CSRF). 2-commit optimism cycle.
  - At least **3 distinct "ship and re-ship within the hour" cycles** in 13 days.
- **Force-push detection:** `git reflog` in a fresh local clone does not surface remote force-pushes reliably; flagging this as a gap. Cannot confirm or refute force-push behavior from local history alone.
- **Longest consecutive streak of `fix:` commits without an intervening test commit:** the 2026-04-02 17:14 → 18:38 ChatBox cluster is 9 fix commits in 85 minutes with zero test-file additions.

---

## 6. Candidate rules

### Suggested for `~/.claude/CLAUDE.md` (global)

#### Rule: A fix that changes the subject line to `chore:` / `style:` / `docs:` to dodge the test-first rule counts as a violation.

**Why:** 8 of 35 bug-fix-without-test commits were arguably justified mislabels (e.g., `ec73bf53` was literally a quiz.md reformat tagged `fix:`), but they were still tagged `fix:`. The canonical rule says "rename the commit subject to `docs:` or `chore:` instead" but does not prohibit the inverse: re-tagging after the fact. Tighten the phrasing so the _discipline_ is in the thinking, not in the label-swap.
**How to apply:** At commit time, ask: "If I relabel this `chore:`, does a latent test become unnecessary, or does it just hide a gap?" If the latter, keep `fix:` and add the test.
**Evidence:** `ec73bf53` (quiz.md reformat as `fix:`), `a085bf28` (CSS color as `fix:`), `d3b8859e` (prompt tweak as `fix:`).
**Suggested location:** `~/.claude/CLAUDE.md` — augment the existing "Test-first bug fixing" section.

#### Rule: Never batch unrelated bug IDs into a single commit.

**Why:** Voyager's history shows 4 "fix: resolve bugs BN-BM" commits covering 21 unrelated bugs. This destroys per-bug revertability, hides which specific change caused any new regression, and makes test-first traceability impossible (a single commit touching B1=SSE, B8=data model, B9=auth cookies, is un-reviewable).
**How to apply:** One commit per triage ID. If the same line of code fixes two adjacent IDs (rare), the commit subject must be explicit: `fix(B5, B12): ...` with a body line-item per ID. Never bundle more than 2 IDs.
**Evidence:** `5ab42753` (B1+B3+B8+B9), `15f86be5` (B4-B7), `8f7bae5b` (B10-B13), `047679bc` (B15-B23).
**Suggested location:** `~/.claude/CLAUDE.md` under "Testing / Test-first bug fixing" (the rationale is the same: batched fixes also obliterate test-per-fix discipline).

#### Rule: "style: format all files" commits are smoke. Investigate root cause before committing the drift fix.

**Why:** Three independent "style: format all files" commits in 13 days (`047ad4aa`, `5441c42e`, `91018165`) indicate the pre-commit hook was silently failing or bypassed. The correct response to drift is to fix the hook, not to land the drift-correction and move on. A deliberately-bad-format probe (`27e7c4bc` → revert `823e2ec1`) confirms the hook was being manually verified rather than trusted.
**How to apply:** Before committing any "format all files" cleanup, run `git config --local core.hooksPath`, verify lefthook is installed, and diagnose _why_ the drift accumulated. Add the diagnosis to the commit body. Never land a style-drift commit without a paired "hook verification" commit in the same session.
**Evidence:** `047ad4aa`, `5441c42e`, `91018165`, `27e7c4bc`/`823e2ec1` probe+revert pair.
**Suggested location:** `~/.claude/CLAUDE.md` under "Debugging and fixing / Root cause, not symptoms."

#### Rule: Production-asset build contracts require a dist-content smoke test.

**Why:** Voyager shipped a production crash (`bea33cc5`) because `destinations.json` was not copied to `dist/`. A similar earlier pattern (`9f08897b`) was worked around by inlining JSON into TS. The repo learned this lesson twice, once a workaround and once a prod crash. A smoke test that asserts `dist/` contains the expected asset manifest would have caught both.
**How to apply:** For every runtime-loaded asset (JSON, YAML, SQL, markdown prompt, etc.) that lives outside the compiled TS graph, add a build-smoke step: a script that runs after `tsc` and asserts the file exists under `dist/` at the expected resolved path. Same script runs in CI and in the Dockerfile build stage.
**Evidence:** `3f8a2fb3`, `9f08897b`, `90470b14`, `bea33cc5`.
**Suggested location:** `~/.claude/CLAUDE.md` under "Testing / Smoke tests" (or a new "Build contracts" section).

### Suggested for `voyager/CLAUDE.md` (project)

#### Rule: `docs/BUGS.md` must tag every entry with severity and effort; no unbounded lists.

**Why:** BUGS.md is a flat list (B1-B23) with no severity, no effort, no triage. B14 is a P0 (data persistence broken) sitting in the "Open" section with no urgency signal. The global rule ("Triage audit findings by severity") is bypassed by using BUGS.md as an unscoped bucket.
**How to apply:** Every new BUGS.md entry needs `severity: P0|P1|P2|P3` and `effort: S|M|L` on its first line. Anything P0/P1 must also be mirrored into the current `docs/audits/YYYY-MM-DD-triage.md`.
**Evidence:** `docs/BUGS.md` (as of 2026-04-06), commits `5ab42753`, `15f86be5`, `8f7bae5b`, `047679bc` (which fixed unrelated severities together).
**Suggested location:** `voyager/CLAUDE.md`.

#### Rule: Voyager's ChatBox rendering has a dedicated data-model invariant test before any new fix lands.

**Why:** The 9-commit ChatBox fix cluster on 2026-04-02 shows the team patching symptoms (card persistence, text duplication, empty state, chip placement) without ever writing down what the ChatBox data model's invariants are. Every new fix risks reintroducing an earlier symptom.
**How to apply:** Before landing any further ChatBox fix, write a vitest spec in `web-client/src/components/ChatBox/ChatBox.invariants.test.tsx` that enumerates the invariants (tool-result cards persist after stream end, text nodes never duplicate, empty state renders when node list is empty, virtualizer layout is stable under append). Every subsequent ChatBox fix must extend this spec, not create a new ad-hoc test.
**Evidence:** `183eb289`, `0c043b97`, `b64de50f`, `2523eeda`, `09bf8eaa` (debug:), `e62bc046`, `1eb12aca`, `6ecef94e`, `9e2eab7d`.
**Suggested location:** `voyager/CLAUDE.md` under a new "ChatBox invariants" section.

#### Rule: Voyager is trunk-based, so the pre-push fast lane is the only code-review gate. Never bypass it.

**Why:** Voyager has 0 merge commits and no PRs. There is no human code review boundary. The lefthook pre-push hook is the only pre-main gate, and the `27e7c4bc` → `823e2ec1` probe-and-revert shows the hook was being manually tested because trust was already low. Combined with three "style: format all files" drift-correction commits, the pre-push lane is not being treated as authoritative.
**How to apply:** No `--no-verify` without explicit user authorization per commit. After any hook bypass, the next commit on main must re-run `pnpm format:check && pnpm lint && pnpm test && pnpm build` in its body as evidence. If the hook is found to be failing spuriously, fix the hook that day, before the next feature commit.
**Evidence:** 0 merge commits (`git log --merges` is empty), `047ad4aa`, `5441c42e`, `91018165`, `27e7c4bc`, `823e2ec1`.
**Suggested location:** `voyager/CLAUDE.md` under the existing "Pre-commit / pre-push verification" section.

---

## 7. Anti-patterns to avoid

Negative space. Things Voyager's history shows DO NOT work.

### Anti-pattern A: "Ship the fix, deploy immediately, patch the prod crash."

**Evidence:** `90470b14` (18:21) → `bea33cc5` (19:22) shipped a JSON-loading fix and hit a Railway crash 1 hour later. `54ef202c` (22:42) → `b0c45799` (23:03) added CSRF and reverted 21 minutes later. `0f4afdbc` (15:54) → `44d660e8` (15:58) shipped an eval fix that broke itself in 4 minutes.
**Why it feels reasonable:** "I'll just push and watch the logs." **Why it does not work:** the round trip is always longer than a local reproduction, and each prod crash leaks state (restarts, partial deploys) that contaminates the next debugging session. Explicit violation of `~/.claude/CLAUDE.md` → "Never deploy to 'see if it works.'"

### Anti-pattern B: "Batch cosmetic fixes with P0 fixes in one commit to 'clear the backlog.'"

**Evidence:** `047679bc` resolves B22 (NaN over-budget display, P0) alongside B15 (coral logo), B17 (border radius), B19 (6px gap). `5ab42753` resolves B9 (mobile Safari auth, P1) alongside B8 (data consolidation cleanup).
**Why it feels reasonable:** "While I'm in there, I'll clean up the small stuff too." **Why it does not work:** the P0 now cannot be reverted without dragging cosmetic regressions with it, and the commit body hides the severity of the real fix behind a laundry list.

### Anti-pattern C: "Add console.log and debug commits directly on main."

**Evidence:** `09bf8eaa` "debug: add console.log to ChatBox, fix virtualizer layout, add empty state" landed on main and stayed there until a later "Remove debug console.log" cleanup. Three times the word "debug" or "console.log" appears in Voyager commit bodies.
**Why it feels reasonable:** "It's a small temporary addition, I'll clean it up next commit." **Why it does not work:** log noise persists in production for hours, contaminates Sentry signal, and the follow-up cleanup is never in the same session. Debug logs belong in a separate short-lived branch or behind a feature flag, not on main.

### Anti-pattern D: "`git add .` and trust the staging area."

**Evidence:** `2890a276` "feat: add frontend test files and vitest config (missed in prior commit)" self-reports a `git add .` miss. `bea33cc5` missed the Dockerfile COPY directive on a prior commit.
**Why it feels reasonable:** `git add .` is fast. **Why it does not work:** scaffolded files (tests, vitest.config.ts, Dockerfile patches) sit in positions the wildcard misses when `.gitignore` or the current working directory is not exactly right. Run `git status` after `git add`, always.

---

## 8. Anomalies worth watching

Observations below the 3-instance threshold. Not rules yet, but worth tracking.

- **Single revert in 13 days (`823e2ec1`), and it was a deliberate hook probe, not a real revert.** Low revert count could mean either (a) fewer mistakes reach main (unlikely given the fix rate) or (b) team prefers forward-fixing over reverting, even when a revert would be cleaner. Watch if, over the next 30 days, any "forward fix" ends up longer than the original "revert-and-redo" would have been.
- **One-off chat handler race condition (`7ad22496` conversation lock).** A single concurrency fix at 07:47 is not a pattern yet, but concurrency bugs rarely arrive alone. Watch `server/src/handlers/chat/chat.ts` for a second concurrency fix in the next 30 days; if it appears, promote to a rule about "every agent-loop surface needs an explicit concurrency test."
- **One "Reuse prod ANTHROPIC_API_KEY for E2E instead of a dedicated E2E key."** Commit body hints the team is blurring the line between test and prod secrets. If this shows up twice more, promote to a rule about test-key hygiene.
- **Eval suite (`fb10958c`, `984e9d24`, `44d660e8`, `0f4afdbc`) shipped but not yet integrated into CI.** Watch whether the eval score becomes a pre-deploy gate or stays as a one-off report.
- **"Lazy-init Anthropic clients" (`cd7f3ddad`) is a single instance, but it describes a whole class of test-time env issues** (env not loaded, NODE_ENV not set, client constructed at module-load time). Next instance of any of these, promote to a rule about deferred SDK instantiation.
- **`0a0ab470` "TripDetailsForm sends structured data ... instead of natural language"** is a single refactor moving away from "ask the LLM to parse a form." If a second feature repeats the same mistake (sending natural language where structured data should go), this becomes a rule about the agentic loop's input contract.

---

**Report file:** `/Users/iangreenough/Desktop/code/personal/production/voyager/docs/audits/2026-04-06-process-retrospective.md`
