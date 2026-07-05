
## Goal

Rename and expand the existing ASC 606 surface into **Revenue Compliance Review** — an AI-assisted commercial review that categorizes findings, surfaces missing info, and generates recommended tasks. Keep the existing paid assessment engine (`asc606_assessments`, edge functions, credit wallets, dialog) fully intact underneath; this is an additive re-shaping of the presentation + a richer report structure.

## Scope (this iteration)

Build the full UI framework, wire it to the existing assessment data, and extend the edge function report schema so the AI populates the new categories. Configurable rules engine + manual override persistence are stubbed as future work (noted, not built).

## Changes

### 1. Report schema (backend, minimal edit)
File: `supabase/functions/asc606-run-assessment/index.ts`
- Extend the system prompt + output schema so `report_jsonb` also returns:
  - `compliance_score` (0–100), `risk_level` (low/medium/high), `confidence` (0–100)
  - `categories[]`: `{ key, label, status: pass|review|missing, confidence, findings[], references[], commercial_impact, recommended_action }` for the 8 categories (Contract Identification, Performance Obligations, Transaction Price, Billing Terms, Contract Modifications, Renewal & Termination, Commercial Completeness, Revenue Intelligence Validation)
  - `ai_observations[]` (natural-language strings)
  - `recommended_actions[]`: `{ title, category, priority }`
  - `executive_summary` (string)
  - `readiness`: `{ commercial_completeness, revenue, billing, collection }` (each 0–100)
- Preserve all existing fields for back-compat. Older assessments without new fields render with graceful fallbacks.

### 2. New presentation components
- `src/components/contracts/RevenueComplianceReview.tsx` — main card, replaces `Asc606ConsolidatedCard` on the contract detail page. Shows:
  - Header: "Revenue Compliance Review" + subtitle
  - Big score ring (green/yellow/red), Risk Level, Confidence badges
  - Readiness mini-bars (Commercial / Revenue / Billing / Collection)
  - Executive Summary block
  - Accordion of 8 category cards (status pill, confidence, findings bullets, references, commercial impact, recommended action, "Create task" button)
  - AI Observations list
  - Recommended Actions list with per-item "Add to Tasks" (uses existing `collection_tasks` insert pattern from `ContractTasksPanel`)
  - Locked/empty state when no completed paid assessment — CTA opens existing `Asc606AssessmentDialog`
  - Re-run + "Open full report" links preserved
- `src/components/contracts/revenue-compliance/CategoryCard.tsx`, `ScoreRing.tsx`, `ReadinessBars.tsx` — small presentational helpers.

### 3. Contract detail page
File: `src/pages/LiveContractDetail.tsx`
- Reorder sections to: Contract Overview → Commercial Terms → Revenue Metrics → **Revenue Compliance Review** → Contract Intelligence Timeline → Tasks & Recommendations.
- Swap `<Asc606ConsolidatedCard>` for `<RevenueComplianceReview>` (same props).

### 4. Full details page
File: `src/pages/Asc606AssessmentDetails.tsx`
- Rename title to "Revenue Compliance Review", keep route `/contracts/live/:importId/asc606` for link compatibility.
- Reuse the new category/observations/actions components to render the full expanded view alongside the existing markdown report and AI advisor chat.

### 5. Task integration
- Recommended actions and per-category "Create task" call `supabase.from("collection_tasks").insert(...)` scoped to the contract's `debtor_id` (mirroring `ContractTasksPanel`). No new tables.

### 6. Not in scope this pass (documented for future)
- Manual override persistence (reviewer / date / notes / approval) — UI hooks stubbed with a "Coming soon" note; no schema change yet.
- Configurable rules engine (company policies, SOX, IFRS 15) — architecture leaves `categories[]` open-ended so custom keys can be added later.

## Preserved

- Paid gating, credit wallet, `Asc606AssessmentDialog`, re-run confirmation, PwC reference banner, required-docs checklist, AI advisor chat, current-date anchoring — all untouched.

## Files

- Edit: `supabase/functions/asc606-run-assessment/index.ts`, `src/pages/LiveContractDetail.tsx`, `src/pages/Asc606AssessmentDetails.tsx`
- Create: `src/components/contracts/RevenueComplianceReview.tsx`, `src/components/contracts/revenue-compliance/CategoryCard.tsx`, `ScoreRing.tsx`, `ReadinessBars.tsx`
- Keep (unused going forward but not deleted): `Asc606ConsolidatedCard.tsx` — will remove once new card is validated.

Approve and I'll build it.
