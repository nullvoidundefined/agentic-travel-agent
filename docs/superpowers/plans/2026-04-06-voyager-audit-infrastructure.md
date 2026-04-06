# Voyager Audit Infrastructure & Triage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 Voyager-tailored audit slash-commands, run them in parallel, and triage the findings into a P0/P1 fix queue plus a P2/P3 `ISSUES.md` rolling log.

**Architecture:** Phase 1 writes 6 prompt files under `.claude/commands/` that each tell Claude to produce a dated audit file under `docs/audits/`. Phase 2 dispatches 6 subagents in parallel using `isolation: "worktree"` so concurrent commits never conflict. Phase 3 reads all 6 audit files and produces a single consolidated triage document plus an `ISSUES.md` update.

**Tech Stack:** Claude Code slash-commands (Markdown prompts), Agent tool with worktree isolation, Playwright/Vitest stacks are NOT touched in this plan.

**Scope note:** This plan covers Phases 1–3 of the full design at `docs/superpowers/specs/2026-04-06-doppelscript-learnings-to-voyager-design.md`. Phase 4 (E2E coverage) and Phase 5 (test gates + P0/P1 fixes) will be written as separate plans after this plan completes and the triage file exists — those plans depend on the triage output to scope prerequisite fixes (e.g., whether the tool executor supports adapter injection for E2E mocking).

**Source spec:** `docs/superpowers/specs/2026-04-06-doppelscript-learnings-to-voyager-design.md`

---

## File structure

Files created or modified by this plan:

```
voyager/
├── .claude/commands/
│   ├── audit-engineering.md    [CREATE]
│   ├── audit-security.md       [CREATE]
│   ├── audit-design.md         [CREATE]
│   ├── audit-ux.md             [CREATE]
│   ├── audit-marketing.md      [CREATE]
│   └── audit-criticism.md      [CREATE]
├── docs/audits/                [CREATE directory]
│   ├── .gitkeep                [CREATE — keeps empty dir tracked before Phase 2]
│   ├── 2026-04-06-engineering.md   [CREATE by subagent in Phase 2]
│   ├── 2026-04-06-security.md      [CREATE by subagent in Phase 2]
│   ├── 2026-04-06-design.md        [CREATE by subagent in Phase 2]
│   ├── 2026-04-06-ux.md            [CREATE by subagent in Phase 2]
│   ├── 2026-04-06-marketing.md     [CREATE by subagent in Phase 2]
│   ├── 2026-04-06-criticism.md     [CREATE by subagent in Phase 2]
│   └── 2026-04-06-triage.md        [CREATE in Phase 3]
└── ISSUES.md                   [CREATE or APPEND in Phase 3]
```

**Conventions:**
- Audit command files are plain Markdown prompts. They have no tests of their own — the "test" is that Phase 2 runs them successfully. So Tasks 2–7 do not follow a TDD loop; they just write, verify structure, and move on.
- Phase 2 and Phase 3 have meaningful verification steps (file existence, required section presence, every finding traced) that act as their tests.

---

## Task 1: Scaffold `docs/audits/` directory

**Files:**
- Create: `docs/audits/.gitkeep`

- [ ] **Step 1: Verify current state**

Run: `ls docs/ 2>&1`

Expected: The `audits/` subdirectory does NOT exist yet. Other files like `USER_STORIES.md` do.

- [ ] **Step 2: Create the directory and `.gitkeep` sentinel**

Use the Write tool to create `docs/audits/.gitkeep` with empty content. (The Write tool will create parent directories automatically.)

- [ ] **Step 3: Verify creation**

Run: `ls -la docs/audits/`

Expected: Output shows `.gitkeep` file exists in the directory.

- [ ] **Step 4: Do NOT commit yet**

The `.gitkeep` will be committed as part of Task 8 alongside the audit commands.

---

## Task 2: Write `audit-engineering.md` command

**Files:**
- Create: `.claude/commands/audit-engineering.md`

- [ ] **Step 1: Write the command file**

Use the Write tool to create `.claude/commands/audit-engineering.md` with this exact content:

````markdown
You are a Principal Engineer with 20+ years of experience in distributed systems, API design, security, performance, and production-grade TypeScript / Node.js applications. You have deep expertise in agentic AI systems, tool-use loops, and multi-step reasoning architectures. Conduct a comprehensive engineering audit of Voyager.

## Instructions

1. Work on the current branch (do not create a new branch).
2. Read the full Voyager codebase — `server/`, `web-client/`, `packages/`, database migrations under `server/migrations/`, `Dockerfile.server`, `railway.toml`, the agent loop in `server/src/services/agent.service.ts`, tool definitions and executors, the SerpApi and Google Places clients, the cache service, dependencies, CI / CD config.
3. Also read `.claude/bottomlessmargaritas/CLAUDE-BACKEND.md`, `CLAUDE-DATABASE.md`, `CLAUDE-FRONTEND.md`, `docs/FULL_APPLICATION_SPEC.md`, and `docs/USER_STORIES.md` to understand architectural intent.
4. Generate a file at `docs/audits/YYYY-MM-DD-engineering.md` (use today's date) with the following sections:

   - **Executive Summary** — high-level assessment and top 3 priorities
   - **Agent Loop Correctness** — tool-call budget enforcement, max-15 safety limit, malformed tool-response handling, reasoning-between-calls integrity, streaming behavior, token budget tracking, whether the tool executor supports adapter injection (important for E2E mocking)
   - **External API Integration** — SerpApi caching strategy and quota management, Google Places rate limiting, error and timeout handling, retry logic, cost per agent turn
   - **Architecture & Design** — layering between routes / handlers / services / repositories, separation of concerns, monorepo hygiene (pnpm workspaces, shared types between server and web-client), coupling hotspots
   - **Code Quality** — consistency, naming, duplication, dead code, complexity hotspots, dead Amadeus references in schema / tests / docs (flagged in prior investigation — evaluate whether to remove or actually implement)
   - **Security** — auth flow, CSRF pattern, input validation, secrets management, prompt injection through the agent loop
   - **Database** — schema design, query patterns, indexing, migration hygiene, connection pooling, raw SQL correctness, pg driver usage
   - **API Design** — route consistency, error response shape, rate limiting, versioning, request validation (Zod or otherwise)
   - **Performance** — N+1 queries, bundle size, caching layer effectiveness, cold start, agent turn latency
   - **Testing** — coverage gaps at unit, integration, and E2E levels; test quality; missing edge cases; mocking discipline
   - **Docker & Railway Build** — `Dockerfile.server` correctness, multi-stage build effectiveness, image size, `railway.toml`, environment variable hygiene
   - **Dependencies & Supply Chain** — outdated packages, unnecessary deps, security advisories, lockfile integrity
   - **DevOps & Deployment** — CI / CD, monitoring, logging, error tracking, rollback strategy
   - **Tech Debt Register** — known shortcuts, TODOs, deferred decisions, with risk ratings
   - **Prioritized Recommendations** — ranked list of actionable improvements with estimated impact (High / Med / Low) and effort (High / Med / Low)

5. Commit the audit file to the current branch.
6. Report back with a summary of your findings.

Be specific. Reference actual files, functions, and line numbers. Don't be generic — this is a real audit, not a template. If you find the Amadeus integration is referenced but never called, call it out and recommend removal or implementation.
````

- [ ] **Step 2: Verify the file structure**

Read the file back and confirm:
- Starts with a Principal Engineer persona sentence
- Has an "## Instructions" section
- Step 4 references `docs/audits/YYYY-MM-DD-engineering.md`
- Includes "Agent Loop Correctness" as a section (Voyager-specific)
- Includes "External API Integration" as a section (Voyager-specific)
- Ends with a "be specific, reference actual files" closing line
- Does NOT create a new branch (step 1 says "Work on the current branch")

- [ ] **Step 3: Do NOT commit yet**

All 6 audit commands will be committed together in Task 8.

---

## Task 3: Write `audit-security.md` command

**Files:**
- Create: `.claude/commands/audit-security.md`

- [ ] **Step 1: Write the command file**

Use the Write tool to create `.claude/commands/audit-security.md` with this exact content:

````markdown
You are a Chief Information Security Officer (CISO) and former red team lead with 20+ years of experience in application security, penetration testing, threat modeling, and compliance. You have special expertise in securing LLM-powered applications, including prompt injection defense, tool-use sandboxing, and API key handling in agentic systems. Conduct a comprehensive security audit of Voyager.

## Instructions

1. Work on the current branch (do not create a new branch).
2. Read the full Voyager codebase — `server/` (especially auth, middleware, agent loop, tool executors), `web-client/` (auth flows, API calls), database queries, migrations, `Dockerfile.server`, `railway.toml`, environment config, and dependencies.
3. Also read `.claude/bottomlessmargaritas/CLAUDE-BACKEND.md`, `CLOUD-DEPLOYMENT.md`, `docs/FULL_APPLICATION_SPEC.md`, and any existing security notes to understand the posture and threat model.
4. Generate a file at `docs/audits/YYYY-MM-DD-security.md` (use today's date) with the following sections:

   - **Executive Summary** — high-level risk assessment and top 3 critical findings
   - **LLM & Agent Loop Security** — Anthropic API key handling (no leakage through tool results or error messages), prompt injection surface area (user message → agent → SerpApi query), tool-use sandboxing, max-15 tool-call safety limit, malformed tool-response handling
   - **External API Key Management** — SerpApi key rotation, Google Places key scoping, environment variable hygiene across Railway / Vercel / local, separate keys for dev / staging / prod
   - **Authentication & Session Management** — Supabase auth flow, session lifecycle, cookie flags (SameSite, Secure, HttpOnly), logout, token refresh, brute force protection
   - **Authorization & Access Control** — RLS on trip data, IDOR risks on trip / user endpoints, multi-tenant isolation
   - **CSRF & Cross-Origin** — CSRF pattern (verify which variant — header-based or cookie-based), CORS config for Vercel preview URLs, `credentials: 'include'` hygiene
   - **Input Validation & Injection** — Zod validation coverage, SQL injection via raw queries, XSS, path traversal, header injection
   - **API Security** — rate limiting, verbose errors leaking internals, missing auth on endpoints, enumeration attacks
   - **Data Protection** — PII handling in trip data, encryption in transit, secrets in logs, backup security
   - **Dependency & Supply Chain** — known CVEs, outdated packages, lockfile integrity
   - **Infrastructure & Deployment** — Docker image hygiene, Railway env var scoping, HTTPS enforcement, header hardening (HSTS, CSP, X-Frame-Options)
   - **Threat Model** — attacker personas, attack trees for the 3 most likely attack vectors against a travel-planning agent, blast radius assessment
   - **Prioritized Findings** — ranked list using severity (Critical / High / Medium / Low) with CVSS-like scoring, exploitability assessment, and remediation steps

5. Commit the audit file to the current branch.
6. Report back with a summary of your findings.

Be specific. Reference actual files, functions, line numbers, and code patterns. Demonstrate exploitability where possible. Don't be generic — this is a real security audit, not a compliance checklist.
````

- [ ] **Step 2: Verify the file structure**

Read the file back and confirm:
- Starts with a CISO / red team persona sentence
- Step 4 references `docs/audits/YYYY-MM-DD-security.md`
- Includes "LLM & Agent Loop Security" as the first sub-section after Executive Summary (Voyager-specific)
- Includes "External API Key Management" section
- Does NOT create a new branch
- Ends with the "be specific, demonstrate exploitability" closing line

- [ ] **Step 3: Do NOT commit yet**

---

## Task 4: Write `audit-design.md` command

**Files:**
- Create: `.claude/commands/audit-design.md`

- [ ] **Step 1: Write the command file**

Use the Write tool to create `.claude/commands/audit-design.md` with this exact content:

````markdown
You are a Head of Design with 20+ years of experience in visual design, design systems, typography, color theory, motion design, and brand identity for SaaS products. You have a special eye for conversational UI, chat interfaces, travel product aesthetics, and the tension between information-dense itineraries and calm, readable layouts. Conduct a comprehensive design audit of Voyager.

## Instructions

1. Work on the current branch (do not create a new branch).
2. Read the full Voyager web-client — `web-client/src/app/`, all components, SCSS modules, global styles, hero carousels, destination cards, trip detail pages, chat UI, itinerary layout, modals, forms.
3. Also read `.claude/bottomlessmargaritas/CLAUDE-FRONTEND.md`, `CLAUDE-STYLING.md`, and `docs/FULL_APPLICATION_SPEC.md` to understand the intended visual identity and styling conventions.
4. Generate a file at `docs/audits/YYYY-MM-DD-design.md` (use today's date) with the following sections:

   - **Executive Summary** — high-level assessment and top 3 priorities
   - **Visual Identity & Brand Coherence** — does the UI express a coherent travel brand? Logo, color usage, personality, tone
   - **Typography** — type scale, hierarchy, readability, font choices, line lengths, vertical rhythm across home / explore / destination / trip pages
   - **Color System** — palette usage, contrast ratios, semantic color mapping, accent consistency across components
   - **Layout & Spacing** — grid system, whitespace rhythm, alignment, density balance (especially in itinerary and tile-card views)
   - **Hero & Imagery** — hero carousel quality, destination photography, image treatment, responsive image strategy, alt text coverage
   - **Component Design** — destination cards, tile cards (flights / hotels / experiences), chat bubbles, form controls, modals — consistency and polish
   - **Iconography** — icon set coherence, illustration style, empty state visuals
   - **Motion & Animation** — transitions, loading states, tool-call progress indicators, timing / easing consistency, `prefers-reduced-motion` support
   - **Design System Maturity** — token usage, CSS custom property discipline, component reusability, documentation
   - **Visual Hierarchy & Scannability** — can users quickly find what matters in a long itinerary? Is the eye guided correctly in the chat + tile-card flow?
   - **Responsive Design** — breakpoint behavior, mobile itinerary usability, touch targets, mobile chat UX
   - **Polish & Craft** — pixel-level details, edge cases, hover / focus / active states, skeleton screens, loading placeholders
   - **Prioritized Recommendations** — ranked list of actionable improvements with estimated impact (High / Med / Low) and effort (High / Med / Low)

5. Commit the audit file to the current branch.
6. Report back with a summary of your findings.

Be specific. Reference actual files, components, SCSS module classes, and design tokens. Don't be generic — this is a real audit, not a template.
````

- [ ] **Step 2: Verify the file structure**

Read the file back and confirm:
- Starts with a Head of Design persona sentence
- Step 4 references `docs/audits/YYYY-MM-DD-design.md`
- Includes "Hero & Imagery" and "Motion & Animation" sections
- Does NOT create a new branch

- [ ] **Step 3: Do NOT commit yet**

---

## Task 5: Write `audit-ux.md` command

**Files:**
- Create: `.claude/commands/audit-ux.md`

- [ ] **Step 1: Write the command file**

Use the Write tool to create `.claude/commands/audit-ux.md` with this exact content:

````markdown
You are a Head of UX with 20+ years of experience in product design, user research, interaction design, accessibility, and information architecture. You have deep expertise in conversational AI interfaces, multi-step agent flows, and the UX challenges specific to AI products that need to feel trustworthy, transparent, and in the user's control. Conduct a comprehensive user experience audit of Voyager.

## Instructions

1. Work on the current branch (do not create a new branch).
2. Read the full Voyager codebase with a focus on user-facing flows — all pages in `web-client/src/app/`, chat UI, tile-card flow, booking / checkout, onboarding, preferences wizard, error states, loading states, empty states.
3. Also read `docs/USER_STORIES.md`, `docs/FULL_APPLICATION_SPEC.md`, and `.claude/bottomlessmargaritas/CLAUDE-FRONTEND.md` to understand the intended user journeys and target persona.
4. Generate a file at `docs/audits/YYYY-MM-DD-ux.md` (use today's date) with the following sections:

   - **Executive Summary** — high-level assessment and top 3 priorities
   - **Conversational Agent UX** — turn latency perception, loading states during tool calls, tool-call transparency (can users see what the agent is doing, what it found, why it chose this flight?), perceived control, how users feel when the agent makes a decision for them
   - **Information Architecture** — navigation between home / explore / destination / trips / chat / account, findability, mental model alignment
   - **User Flows** — critical path (signup → first trip planned → booked), friction points, dead ends, confusion risks in the chat + tile-card flow
   - **Onboarding & First-Run** — preferences wizard, time-to-first-value, the "what is this product" moment
   - **Error Recovery Mid-Conversation** — what happens if a tool call fails, if Claude hallucinates, if SerpApi returns empty results, if the user changes their mind mid-plan
   - **Iteration Experience** — how easy is it to modify a saved trip, swap a flight, adjust budget, undo a decision
   - **Forms & Input** — chat input, wizard steps, trip detail form, validation, error messages, progressive disclosure
   - **Feedback & State Communication** — loading states, empty states, success confirmations, agent-thinking indicators, progress during multi-step agent turns
   - **Accessibility** — WCAG 2.1 AA compliance, keyboard navigation, screen reader support for the chat flow, color contrast, focus management, `prefers-reduced-motion`, ARIA on tile-card groups
   - **Responsive & Mobile** — chat experience on mobile, itinerary on mobile, tile-card tap targets
   - **Cognitive Load** — information density, decision fatigue, jargon, how much the user has to hold in their head between agent turns
   - **Consistency & Patterns** — UI pattern reuse, terminology alignment, interaction model consistency
   - **Prioritized Recommendations** — ranked list of actionable improvements with estimated impact (High / Med / Low) and effort (High / Med / Low)

5. Commit the audit file to the current branch.
6. Report back with a summary of your findings.

Be specific. Reference actual files, components, user flows, and user stories by ID (e.g., US-12). Don't be generic — this is a real audit, not a template.
````

- [ ] **Step 2: Verify the file structure**

Read the file back and confirm:
- Starts with a Head of UX persona sentence
- Step 4 references `docs/audits/YYYY-MM-DD-ux.md`
- Includes "Conversational Agent UX" as the first Voyager-specific section
- Includes "Error Recovery Mid-Conversation" section
- Does NOT create a new branch

- [ ] **Step 3: Do NOT commit yet**

---

## Task 6: Write `audit-marketing.md` command

**Files:**
- Create: `.claude/commands/audit-marketing.md`

- [ ] **Step 1: Write the command file**

Use the Write tool to create `.claude/commands/audit-marketing.md` with this exact content:

````markdown
You are a Senior VP of Marketing with 20+ years of experience in consumer SaaS, growth marketing, brand strategy, and go-to-market execution. You have specifically worked on AI products that have to differentiate against both legacy incumbents (Kayak, Expedia, Booking.com) and the generic-LLM alternative (ChatGPT, Perplexity) — you know how to position "agentic" as a real value prop and not a buzzword. Conduct a comprehensive marketing audit of Voyager.

## Instructions

1. Work on the current branch (do not create a new branch).
2. Read the full Voyager web-client with a focus on marketing surfaces — landing page, hero copy, feature sections, destination explore page, destination detail pages, FAQ, CTAs, onboarding flows, meta tags, OG images, pricing (if any).
3. Also read `docs/FULL_APPLICATION_SPEC.md` and `README.md` to understand intended positioning, target audience, and value proposition.
4. Generate a file at `docs/audits/YYYY-MM-DD-marketing.md` (use today's date) with the following sections:

   - **Executive Summary** — high-level assessment and top 3 priorities
   - **Brand & Positioning** — is the value prop clear? "AI travel agent" vs "agentic travel planner" vs "Kayak but smarter" — does the messaging actually land? Who is the target persona and does the copy speak to them?
   - **Landing Page & Conversion** — hero copy, subhead, CTAs, social proof, trust signals, the "why should I trust this to plan my trip" moment
   - **Competitive Positioning** — how does Voyager stand against Kayak / Expedia / Booking (legacy) AND ChatGPT / Perplexity (generic LLMs)? What is the moat? Where is this product vulnerable?
   - **Destination Content** — do the explore page and destination detail pages read as high-quality travel content, or as thin SEO pages? Does the content build trust?
   - **SEO & Discoverability** — meta tags, page titles, structured data, sitemap, OG images, content strategy
   - **Onboarding & Activation** — first-run experience, preferences wizard framing, time-to-value, the moment the user realizes "oh, this is different"
   - **CTAs & Copy** — button labels, microcopy, empty states, error messages — does the voice feel human, trustworthy, and in control?
   - **Growth Loops & Retention** — is there any virality? Referrals? Re-engagement? Save-a-trip mechanics that bring users back?
   - **Trust Signals** — real bookings vs research-only positioning, handling of booking responsibility, privacy, data handling transparency
   - **Prioritized Recommendations** — ranked list of actionable improvements with estimated impact (High / Med / Low)

5. Commit the audit file to the current branch.
6. Report back with a summary of your findings.

Be specific. Reference actual files, copy, and components. Don't be generic — this is a real audit, not a template.
````

- [ ] **Step 2: Verify the file structure**

Read the file back and confirm:
- Starts with a SVP of Marketing persona sentence
- Step 4 references `docs/audits/YYYY-MM-DD-marketing.md`
- Includes "Competitive Positioning" section mentioning Kayak / Expedia / ChatGPT (Voyager-specific)
- Does NOT create a new branch

- [ ] **Step 3: Do NOT commit yet**

---

## Task 7: Write `audit-criticism.md` command

**Files:**
- Create: `.claude/commands/audit-criticism.md`

- [ ] **Step 1: Write the command file**

Use the Write tool to create `.claude/commands/audit-criticism.md` with this exact content:

````markdown
You are a ruthless, world-class product critic — part technical reviewer, part business strategist, part angry customer. You have zero tolerance for mediocrity, hand-waving, and "good enough." You have shipped products used by millions and torn apart products that deserved it. You are not here to be nice. You are here to make Voyager excellent by finding every weakness, every shortcut, every lie the team tells itself.

Your job is not to encourage. It is to expose. If something is bad, say it is bad and say why. If something is half-done, call it half-done. If a decision was lazy, say so. If the core idea itself is flawed — if the product concept has a fatal weakness, if the market thesis is wrong, if the whole thing is solving a problem nobody has — say that too. Nothing is sacred. Not the idea, not the architecture, not the business model. The team can handle it — they asked for this.

## Instructions

1. Work on the current branch (do not create a new branch).
2. Read EVERYTHING — the full Voyager codebase, `docs/FULL_APPLICATION_SPEC.md`, `docs/USER_STORIES.md`, the landing page, onboarding, the agent loop, the database schema, the tests, the deployment config, the marketing copy, `README.md`.
3. Generate a file at `docs/audits/YYYY-MM-DD-criticism.md` (use today's date). This is not a structured corporate audit. It is a brutally honest teardown. Structure it however serves the truth best, but cover at minimum:

   - **The Brutal Truth** — if you had to summarize this product's biggest problem in one paragraph, what is it? Do not soften it.
   - **What's Actually Good** — be fair. If something is genuinely well done, acknowledge it briefly. But do not pad this section to be polite.
   - **What's Broken** — things that are objectively wrong, buggy, insecure, or non-functional. Not opinions — facts. Call out the dead Amadeus references in schema / tests / docs and the spec-vs-implementation drift they represent.
   - **What's Weak** — things that technically work but are half-baked, poorly executed, or below the standard the product aspires to
   - **What's Missing** — gaps a real user would hit and be frustrated by. Things the team probably knows about but has not prioritized.
   - **Lies the Team Tells Itself** — assumptions baked into the product that are probably wrong. Features that seem clever but solve no real problem. Complexity that exists because someone thought it was cool, not because users need it.
   - **The User's Experience, Honestly** — walk through the product as a real traveler planning a real trip. Where does it break down? Where do you lose trust in the agent? Where do you give up?
   - **The Business Model Problem** — can Voyager survive 250 SerpApi searches / month on the free tier? What is the realistic cost per trip plan in Claude tokens? Does the unit economics actually work, or is this a venture-subsidy product?
   - **If I Were Competing Against This** — what would you exploit? Where is Voyager most vulnerable to a competitor — legacy (Kayak) or new (ChatGPT Plus with browsing) — who simply does the basics better?
   - **The Hard Prioritization** — if the team could only fix 5 things before showing this to anyone, what should they be? Be specific and justify each.

4. Commit the audit file to the current branch.
5. Report back with a summary of your findings.

Do not hold back. Do not hedge. State what is wrong, why it matters, and what to do about it. Reference specific files, specific code, specific copy, specific flows. Vague criticism is useless. The goal is excellence. The path to excellence runs through honesty.
````

- [ ] **Step 2: Verify the file structure**

Read the file back and confirm:
- Starts with a "ruthless product critic" persona opening
- Has BOTH the opening persona paragraph AND the "Your job is not to encourage" paragraph before the `## Instructions` heading
- Step 3 (NOT step 4 — criticism has one less preparatory step) references `docs/audits/YYYY-MM-DD-criticism.md`
- Includes "The Business Model Problem" section mentioning SerpApi quota and Claude cost (Voyager-specific)
- Does NOT create a new branch

- [ ] **Step 3: Do NOT commit yet**

---

## Task 8: Commit Phase 1 — all 6 audit commands + `.gitkeep`

**Files:**
- Modify (stage and commit): the 7 files from Tasks 1–7

- [ ] **Step 1: Verify all 6 audit commands exist**

Run: `ls .claude/commands/audit-*.md`

Expected output:
```
.claude/commands/audit-criticism.md
.claude/commands/audit-design.md
.claude/commands/audit-engineering.md
.claude/commands/audit-marketing.md
.claude/commands/audit-security.md
.claude/commands/audit-ux.md
```

- [ ] **Step 2: Verify `.gitkeep` exists**

Run: `ls -la docs/audits/`

Expected: `.gitkeep` present.

- [ ] **Step 3: Verify no file says "create a new branch"**

Use the Grep tool: `pattern: "Create and check out a new branch|create a new branch"`, `path: ".claude/commands"`.

Expected: No matches found.

- [ ] **Step 4: Verify every file references `docs/audits/YYYY-MM-DD-`**

Use the Grep tool: `pattern: "docs/audits/YYYY-MM-DD-"`, `path: ".claude/commands"`, `output_mode: "files_with_matches"`.

Expected: All 6 audit-*.md files listed.

- [ ] **Step 5: Stage the files**

Run: `git add .claude/commands/audit-engineering.md .claude/commands/audit-security.md .claude/commands/audit-design.md .claude/commands/audit-ux.md .claude/commands/audit-marketing.md .claude/commands/audit-criticism.md docs/audits/.gitkeep`

Then run: `git status`

Expected: 7 new files staged. No other changes.

- [ ] **Step 6: Commit**

Run:
```bash
git commit -m "$(cat <<'EOF'
feat: add Voyager-tailored audit slash-commands

Adds six role-based audit slash-commands under .claude/commands/:
engineering, security, design, ux, marketing, criticism. Each writes to
docs/audits/YYYY-MM-DD-<type>.md so audit history is preserved across
runs rather than overwriting a single root-level file.

The engineering and security audits include Voyager-specific sections
for agent-loop correctness, external API integration, and LLM key
handling. The criticism audit explicitly calls out the unit economics
question (SerpApi quota, Claude cost per trip plan) and the dead
Amadeus references in schema/tests/docs.

Also adds docs/audits/.gitkeep so the directory exists in git before
any audit files are written into it.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: Commit succeeds. Lefthook pre-commit may run `format:check`, `lint`, `build`. Since no TypeScript or code files changed, these should pass quickly. If any hook fails for an unrelated reason, investigate the root cause — do NOT use `--no-verify`.

- [ ] **Step 7: Verify the commit**

Run: `git log --oneline -1 && git show --stat HEAD`

Expected: Latest commit is `feat: add Voyager-tailored audit slash-commands` and shows 7 files changed (6 audit commands + `.gitkeep`).

---

## Task 9: Phase 2 — dispatch 6 audit subagents in parallel

**Files:**
- Created by subagents: the 6 dated audit files in `docs/audits/`

**Overview:** This task issues 6 `Agent` tool calls in a single message (true parallelism). Each uses `isolation: "worktree"` so concurrent git commits cannot conflict. Each agent receives the full prompt content from its corresponding audit command file (Tasks 2–7) and is told explicitly to write its audit file to the worktree at `docs/audits/2026-04-06-<type>.md`, commit it to the worktree's current branch, and return the final file contents in its response.

- [ ] **Step 1: Confirm today's date for the audit filenames**

Today's date is **2026-04-06**. If the plan is being executed on a different date, substitute that date everywhere below. The filenames must use the actual execution date, not a hardcoded 2026-04-06.

- [ ] **Step 2: Read each of the 6 audit command files**

Use the Read tool on each of:
- `.claude/commands/audit-engineering.md`
- `.claude/commands/audit-security.md`
- `.claude/commands/audit-design.md`
- `.claude/commands/audit-ux.md`
- `.claude/commands/audit-marketing.md`
- `.claude/commands/audit-criticism.md`

Keep the full content of each file in context — it becomes the body of each subagent's prompt.

- [ ] **Step 3: Dispatch all 6 agents in a single message**

In ONE assistant message, issue 6 parallel `Agent` tool calls. For each agent:

- `subagent_type`: `"general-purpose"`
- `isolation`: `"worktree"` (REQUIRED — each audit commits to git, and without worktree isolation the 6 agents would clobber each other)
- `description`: e.g. `"Engineering audit"`, `"Security audit"`, etc. (3–5 words)
- `model`: `"opus"` (audits benefit from the strongest model)
- `prompt`: the FULL content of the matching audit command file, PLUS the following appendix:

```
---

## Execution notes for this subagent

- You are running inside an isolated git worktree of the Voyager repo.
- Today's date is 2026-04-06. Write your audit file to EXACTLY this path: docs/audits/2026-04-06-<type>.md (replacing <type> with your audit type, e.g. "engineering").
- After writing the file, commit it to the current branch with a message like: "audit: <type> 2026-04-06".
- In your final response to the parent session, include: (a) a ~5-sentence summary of your top findings, (b) the full contents of the audit file you wrote (so the parent can consolidate all 6 onto real main).
- Do NOT invoke any other audit command. Do NOT dispatch further subagents. Just do the one audit.
- Be specific. Reference actual files, functions, and line numbers. Generic reports will be rejected.
```

Dispatch all 6 in a single message so they run in parallel. Do NOT dispatch them one at a time.

- [ ] **Step 4: Wait for all 6 subagents to complete**

The Agent tool returns each subagent's final message. Parse out:
- The file contents for each audit file (to be committed to real main in Task 10)
- The top-findings summary for each audit (will be referenced in Task 11 triage)

If any subagent failed or produced a generic report, re-dispatch that one alone with stricter wording (e.g., "Your prior response was too generic — reference specific files and line numbers, not general principles").

- [ ] **Step 5: Verify subagent output quality**

For each of the 6 audit file contents received, spot-check:
- Does it mention at least 3 specific file paths (e.g., `server/src/services/agent.service.ts`)?
- Does it have the section headings from the command (Executive Summary, etc.)?
- Does the Prioritized Recommendations section have at least 3 items with severity / effort tags?

If any audit fails these checks, re-dispatch that one specific audit with the feedback.

- [ ] **Step 6: Do NOT commit yet**

The audit files currently exist only in the 6 worktrees. Task 10 consolidates them onto real `main`.

---

## Task 10: Consolidate audit files onto `main` and commit Phase 2

**Files:**
- Create on `main`: `docs/audits/2026-04-06-engineering.md`
- Create on `main`: `docs/audits/2026-04-06-security.md`
- Create on `main`: `docs/audits/2026-04-06-design.md`
- Create on `main`: `docs/audits/2026-04-06-ux.md`
- Create on `main`: `docs/audits/2026-04-06-marketing.md`
- Create on `main`: `docs/audits/2026-04-06-criticism.md`

- [ ] **Step 1: Write each audit file to the real working tree**

Use the Write tool on each path below, using the file contents returned by the corresponding subagent in Task 9:

- `docs/audits/2026-04-06-engineering.md`
- `docs/audits/2026-04-06-security.md`
- `docs/audits/2026-04-06-design.md`
- `docs/audits/2026-04-06-ux.md`
- `docs/audits/2026-04-06-marketing.md`
- `docs/audits/2026-04-06-criticism.md`

- [ ] **Step 2: Verify all 6 files exist and are non-trivial**

Run: `ls -la docs/audits/2026-04-06-*.md && wc -l docs/audits/2026-04-06-*.md`

Expected: All 6 files listed, each with at least ~50 lines. An audit file shorter than 50 lines is suspect — re-dispatch that audit.

- [ ] **Step 3: Stage the 6 files**

Run: `git add docs/audits/2026-04-06-engineering.md docs/audits/2026-04-06-security.md docs/audits/2026-04-06-design.md docs/audits/2026-04-06-ux.md docs/audits/2026-04-06-marketing.md docs/audits/2026-04-06-criticism.md`

Then run: `git status`

Expected: 6 new files staged. No other changes.

- [ ] **Step 4: Commit**

Run:
```bash
git commit -m "$(cat <<'EOF'
audit: 2026-04-06 run (engineering, security, design, ux, marketing, criticism)

Consolidated output of 6 parallel audit subagents dispatched from the
audit slash-commands added in the previous commit. Each audit was run
by a fresh Opus instance in an isolated git worktree and returned the
file contents to this session for landing on main.

Follow-up: the next commit will produce a triage document at
docs/audits/2026-04-06-triage.md that severity-tags every finding and
routes P0/P1 to the fix queue and P2/P3 to ISSUES.md.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: Commit succeeds. Lefthook may run its hooks — since no code changed, format / lint / build should all pass.

- [ ] **Step 5: Verify the commit**

Run: `git log --oneline -2 && git show --stat HEAD`

Expected: Latest commit is the audit run commit with 6 files changed. Prior commit is the audit slash-command commit from Task 8.

- [ ] **Step 6: Worktree cleanup**

Each of the 6 subagents ran in an isolated worktree. If the worktrees still exist, list them: `git worktree list`. Any worktree that was created by a subagent and is no longer needed can be removed with `git worktree remove <path>`. Do NOT remove the main working tree. If in doubt, leave them — they will not interfere with subsequent tasks.

---

## Task 11: Read audits and produce the triage data

**Files:**
- Read: all 6 files from `docs/audits/2026-04-06-*.md`

- [ ] **Step 1: Read all 6 audit files**

Use the Read tool on each of:
- `docs/audits/2026-04-06-engineering.md`
- `docs/audits/2026-04-06-security.md`
- `docs/audits/2026-04-06-design.md`
- `docs/audits/2026-04-06-ux.md`
- `docs/audits/2026-04-06-marketing.md`
- `docs/audits/2026-04-06-criticism.md`

- [ ] **Step 2: Enumerate every distinct finding**

For each audit, extract every item that represents an actionable finding. An "actionable finding" is anything the team could plausibly open a ticket for — a bug, a security issue, a UX friction point, a design inconsistency, a positioning weakness, a unit-economics risk, dead code, etc. Ignore pure compliments ("this is well done"). Deduplicate across audits — if engineering and security both flag the same CORS misconfiguration, merge them into one finding with both sources listed.

- [ ] **Step 3: Severity-tag each finding**

For each finding, assign:
- **Severity:**
  - **P0** — broken, security hole, data loss, critical path non-functional
  - **P1** — critical path degraded, high-risk, must-fix-before-launch
  - **P2** — quality / UX friction, tech debt with near-term cost
  - **P3** — nice-to-have, cosmetic, long-term polish
- **Effort:** S (< 1 hr), M (1–4 hr), L (> 4 hr)
- **Category:** bug / security / UX / design / marketing / tech-debt
- **Source:** the audit file(s) and section(s) where it was raised

Be honest about severity. Err toward P0/P1 for anything touching security, data integrity, or a user's ability to complete a core flow. Err toward P2/P3 for anything cosmetic or speculative. If you are not sure, default to P2 — do NOT hide things in P3 to shrink the fix queue.

- [ ] **Step 4: Produce an intermediate working list**

Hold the triage data in context as a structured list — you will write it to disk in Task 12 (triage file for P0/P1) and Task 13 (ISSUES.md for P2/P3). Do NOT write anything to disk yet.

A sample entry in your working list:

```
[ENG-01] Agent loop does not enforce the 15-call budget
  Source: docs/audits/2026-04-06-engineering.md §Agent Loop Correctness
  Severity: P0
  Effort: S
  Category: bug
  Repro: send a pathological user message that makes Claude want to keep calling tools; observe no limit
  Fix approach: add a counter to agent.service.ts tool loop; throw if count > 15
```

---

## Task 12: Write the triage file

**Files:**
- Create: `docs/audits/2026-04-06-triage.md`

- [ ] **Step 1: Write the triage file**

Use the Write tool to create `docs/audits/2026-04-06-triage.md` with the following structure. Replace the placeholder counts, IDs, and entries with the actual findings from Task 11:

````markdown
# Audit Triage — 2026-04-06

Consolidated triage of findings from the 6 audits run on 2026-04-06.

## Summary

- **Total findings:** <N>
- **P0 (must fix now):** <N>
- **P1 (fix in this effort):** <N>
- **P2 (logged to ISSUES.md, deferred):** <N>
- **P3 (logged to ISSUES.md, deferred):** <N>

P0 and P1 items below are the fix queue for the next plan (Phase 5 Part D in the source spec). P2 and P3 items are in `ISSUES.md` at the repo root.

**Source audits:**
- `docs/audits/2026-04-06-engineering.md`
- `docs/audits/2026-04-06-security.md`
- `docs/audits/2026-04-06-design.md`
- `docs/audits/2026-04-06-ux.md`
- `docs/audits/2026-04-06-marketing.md`
- `docs/audits/2026-04-06-criticism.md`

## P0 — Must fix now

### [ENG-01] <title>
- **Source:** <audit file> §<section>
- **Severity:** P0 · **Effort:** S · **Category:** bug
- **Repro:** <concrete steps or conditions>
- **Fix approach:** <brief, concrete technical plan>

<repeat for every P0 item>

## P1 — Fix in this effort

### [SEC-03] <title>
- **Source:** <audit file> §<section>
- **Severity:** P1 · **Effort:** M · **Category:** security
- **Repro:** <concrete steps or conditions>
- **Fix approach:** <brief, concrete technical plan>

<repeat for every P1 item>

## P2 / P3

See `ISSUES.md` at the repo root. <N> items logged there, tagged with severity, effort, category, and source.
````

Use stable triage IDs with a prefix matching the source audit category:
- `ENG-*` for engineering
- `SEC-*` for security
- `DES-*` for design
- `UX-*` for ux
- `MKT-*` for marketing
- `CRIT-*` for criticism

Number them sequentially within each prefix starting at 01.

- [ ] **Step 2: Verify the triage file structure**

Read the file back and confirm:
- Has a Summary section with counts
- Has a P0 section (even if empty — say "None" if no P0 findings)
- Has a P1 section (same rule)
- Every P0 and P1 entry has Source / Severity / Effort / Category / Repro / Fix approach fields
- Points to ISSUES.md for P2 / P3

- [ ] **Step 3: Do NOT commit yet**

The triage file and `ISSUES.md` are committed together in Task 14.

---

## Task 13: Create or update `ISSUES.md` with P2 / P3 findings

**Files:**
- Create or modify: `ISSUES.md` (at repo root)

- [ ] **Step 1: Check whether `ISSUES.md` already exists**

Run: `ls ISSUES.md 2>&1`

If it exists, read it first with the Read tool so you can append to it without clobbering. If it does not exist, you will create it fresh.

- [ ] **Step 2: Write or extend `ISSUES.md`**

If creating fresh, start with this header:

````markdown
# Voyager — Open Issues

Rolling log of open issues, P2 / P3 severity. P0 / P1 items live in the current
triage file under `docs/audits/`.

Each entry includes severity, effort, category, and source (which audit surfaced
it). Items are appended over time — never overwrite this file.

---
````

If it already exists, keep its existing contents and append a new dated section:

````markdown
## 2026-04-06 audit run

<every P2 and P3 finding from Task 11, one per entry>
````

Each entry follows this format:

```markdown
### [ENG-07] <title>
- **Source:** docs/audits/2026-04-06-engineering.md §<section>
- **Severity:** P2 · **Effort:** M · **Category:** tech-debt
- **Notes:** <1–2 sentences describing the finding and any fix sketch>
```

Use the same stable triage IDs you chose in Task 12. Do NOT renumber — the same ID should refer to the same finding in both the triage file and ISSUES.md.

- [ ] **Step 3: Verify every Task 11 finding is accounted for**

Count the total number of findings from your Task 11 working list. Count the entries in the triage file (P0 + P1) and in ISSUES.md (P2 + P3 for this run). The totals must match. If not, you dropped a finding — go back and add it.

- [ ] **Step 4: Do NOT commit yet**

---

## Task 14: Commit Phase 3 — triage file + `ISSUES.md`

**Files:**
- Stage and commit: `docs/audits/2026-04-06-triage.md`, `ISSUES.md`

- [ ] **Step 1: Stage both files**

Run: `git add docs/audits/2026-04-06-triage.md ISSUES.md`

Then run: `git status`

Expected: 1 new file (triage) and 1 new-or-modified file (ISSUES.md). No other changes.

- [ ] **Step 2: Determine the severity counts for the commit message**

From Task 11, extract:
- `N_P0` = number of P0 findings
- `N_P1` = number of P1 findings
- `N_P2` = number of P2 findings
- `N_P3` = number of P3 findings

- [ ] **Step 3: Commit**

Run (substituting the actual counts):
```bash
git commit -m "$(cat <<'EOF'
docs: triage 2026-04-06 audit findings (<N_P0> P0, <N_P1> P1, <N_P2> P2, <N_P3> P3)

Reads the 6 audit files from the 2026-04-06 run and produces a
consolidated triage file at docs/audits/2026-04-06-triage.md with
the P0/P1 fix queue. P2/P3 findings are logged to ISSUES.md at the
repo root as a rolling log (not overwritten by future runs).

The P0/P1 queue becomes the scope for the next plan (Phase 5 Part D
in the source spec): test-first fixes on a single branch
fix/audit-2026-04-06-p0p1 with one commit per fix.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: Commit succeeds. Lefthook may run its hooks — since no code changed, format / lint / build should all pass.

- [ ] **Step 4: Verify the commit**

Run: `git log --oneline -3 && git show --stat HEAD`

Expected: Latest commit is the triage commit. Prior two commits are the Phase 2 audit run and the Phase 1 audit slash-commands.

---

## Task 15: Exit verification and handoff

**Files:** none modified.

- [ ] **Step 1: Verify Phase 1 exit criteria**

Run: `ls .claude/commands/audit-*.md`

Expected: exactly 6 files (engineering, security, design, ux, marketing, criticism).

Use the Grep tool: `pattern: "docs/audits/YYYY-MM-DD-"`, `path: ".claude/commands"`, `output_mode: "files_with_matches"`.

Expected: all 6 audit-*.md files matched.

Use the Grep tool: `pattern: "create a new branch|Create and check out"`, `path: ".claude/commands"`, `output_mode: "files_with_matches"`.

Expected: zero matches.

- [ ] **Step 2: Verify Phase 2 exit criteria**

Run: `ls docs/audits/2026-04-06-*.md`

Expected: exactly 6 dated audit files (NOT including the triage file — that's Phase 3).

Run: `wc -l docs/audits/2026-04-06-*.md`

Expected: each file has substantive line count (>= 50 lines). If any is shorter, it's probably a thin report and should be re-run in a follow-up.

- [ ] **Step 3: Verify Phase 3 exit criteria**

Run: `ls docs/audits/2026-04-06-triage.md ISSUES.md`

Expected: both files exist.

Use the Read tool on `docs/audits/2026-04-06-triage.md`. Verify:
- Summary section with counts
- P0 section present
- P1 section present
- Each entry has Source, Severity, Effort, Category, Repro, Fix approach

Use the Read tool on `ISSUES.md`. Verify:
- Has a header explaining its purpose
- Has entries from the 2026-04-06 run (unless there were zero P2/P3 findings, which would be surprising)

- [ ] **Step 4: Verify git history**

Run: `git log --oneline -5`

Expected: the last 3 commits (from newest to oldest) are:
1. `docs: triage 2026-04-06 audit findings (<counts>)`
2. `audit: 2026-04-06 run (engineering, security, design, ux, marketing, criticism)`
3. `feat: add Voyager-tailored audit slash-commands`

- [ ] **Step 5: Produce a handoff report for the next plan**

Write a short summary (as an assistant message, not a committed file) containing:

1. The severity counts from the triage file (N_P0, N_P1, N_P2, N_P3)
2. The top 3 P0 findings by ID and title
3. The top 3 P1 findings by ID and title
4. Any P0/P1 finding that is a **prerequisite for E2E mocking** (specifically: does the engineering audit report whether the tool executor supports adapter injection, or does it need refactoring to support `E2E_MOCK_TOOLS=1`?). This is important input for Plan B (Phase 4 + Phase 5 A/B/C).
5. A sentence identifying which follow-up plan should be written next:
   - **Plan B (Phase 4 + Phase 5 A/B/C):** E2E coverage + test gates. Write this next.
   - **Plan C (Phase 5 Part D):** P0/P1 fix loop. Write after Plan B is executed, or interleave with Plan B if any P0 finding blocks E2E work.

- [ ] **Step 6: Plan complete**

At this point:
- 6 audit slash-commands exist and work on the current branch
- 6 dated audit reports are on `main`
- Triage file categorizes every finding by severity
- `ISSUES.md` holds the P2/P3 rolling log
- The P0/P1 fix queue is ready for Plan C

Report to the user that Plan A is complete and ask which follow-up plan they want drafted next.
