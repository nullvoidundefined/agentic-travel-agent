# Voyager Billing & Spending Caps

This file tracks the hard spending caps configured on every paid
third-party service Voyager depends on, plus the date each cap was set
and the current plan tier. It exists because the 2026-04-06 Financial
audit identified "no hard spending caps on any paid API" as the single
most severe financial risk: a single runaway session could produce a
four or five figure surprise bill in hours.

## Status legend

- **In place** — hard cap is actively configured in the provider's
  console and has been verified manually
- **Pending** — documented here as required, but the manual console
  action has not been performed yet
- **Blocked**: manual console action cannot be taken right now due to
  an external dependency (e.g. an in-progress audit)
- **Code gated** — enforcement is in application code (e.g. per-user
  daily token budget) rather than the provider console

## Caps

| Service                              | Cap                            | Status                       | Configured by                                                       | Date       | Notes                                                                                                                                                                                                                           |
| ------------------------------------ | ------------------------------ | ---------------------------- | ------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anthropic (Claude API)               | $50/month hard cap             | **In place**                 | Manual in console                                                   | 2026-04-07 | Set in `console.anthropic.com` workspace billing settings. FIN-01.                                                                                                                                                              |
| Anthropic (per-user daily budget)    | 50,000 output tokens/user/day  | **Code gated**               | `server/src/services/tokenBudget.service.ts`                        | 2026-04-06 | Redis-backed counter, fails open if Redis unavailable. Second line of defense behind the monthly cap. FIN-05.                                                                                                                   |
| Anthropic (per-turn iteration limit) | 8 iterations                   | **Code gated**               | `server/src/services/AgentOrchestrator.ts` `DEFAULT_MAX_ITERATIONS` | 2026-04-06 | Lowered from 15 to 8 per FIN-06. Bounds worst-case per-message burn.                                                                                                                                                            |
| SerpApi (Google Flights + Hotels)    | Free tier (250 searches/month) | **Pending code enforcement** | `server/src/services/serpapi.service.ts`                            | —          | Redis monthly counter planned in Task 14 (FIN-02). Will refuse to call past 200 with a graceful degrade path.                                                                                                                   |
| Google Cloud (Places API)            | $50/month hard cap             | **Blocked**                  | Manual in Google Cloud Console billing                              | —          | Blocked on 2026-04-07: continuing external audit, no response yet. Cannot log into GCP console to set the cap until the audit clears. Must be set in the Google Cloud Console on the Places API project once unblocked. FIN-03. |
| Railway (server + Postgres + Redis)  | Per-plan usage cap             | **Unaudited**                | Railway dashboard                                                   | —          | Current plan and month-to-date charge not verified. FIN-09.                                                                                                                                                                     |
| Vercel (web-client)                  | Hobby tier (free)              | **Unaudited**                | Vercel dashboard                                                    | —          | Hobby is free for non-commercial use. If Voyager is ever classified as commercial this is a Hobby ToS violation.                                                                                                                |
| Neon (Postgres)                      | Per-plan usage cap             | **Unaudited**                | Neon dashboard                                                      | —          | Plan and MTD charge not verified.                                                                                                                                                                                               |

## Manual actions required before public exposure

The items marked **Pending** above require human action in the
provider consoles. They cannot be automated from the codebase.

1. **Anthropic monthly cap.** Done on 2026-04-07. Hard $50/month
   spending limit configured in `console.anthropic.com` workspace
   billing settings. Row above reflects the current state.
2. **Google Cloud billing cap.** Blocked as of 2026-04-07. A
   continuing external audit is in progress and no response has
   been received yet, so the owner cannot access the Google Cloud
   Console to set the cap. Once the audit clears, log into the
   Google Cloud Console, open Billing for the project that owns
   the Places API key, create a budget with a $50/month cap and a
   hard cutoff alert at 100%, and update the row above from
   "Blocked" to "In place" with the date.

## Revision log

- **2026-04-06**: file created as part of Plan C Task 13 (FIN-01,
  FIN-05, FIN-06). Added code-gated per-user daily token budget via
  `tokenBudget.service.ts`. Lowered `DEFAULT_MAX_ITERATIONS` from
  15 to 8. Documented manual Anthropic and GCP cap actions as
  pending. The Financial audit itself is at
  `docs/audits/2026-04-06-financial.md`.
- **2026-04-07**: Anthropic hard $50/month cap configured in the
  `console.anthropic.com` workspace billing settings; Anthropic row
  moved from Pending to In place. GCP Places row moved from Pending
  to Blocked: a continuing external audit has not been answered yet,
  so the owner cannot log in to the Google Cloud Console to set the
  $50/month cap. Added a "Blocked" status to the legend to cover
  external-dependency cases like this one.
