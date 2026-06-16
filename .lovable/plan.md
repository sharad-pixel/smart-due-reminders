# Nicolas AI Contract Line Review

## Goal
After an OCR/AI contract scan completes, prompt the user (via Nicolas) to verify the extracted Order Form lines and explicitly flag categories the model commonly misses — especially **Fixed Fee Professional Services**. Give users full line-by-line visibility and edit capability on every Order Form / schedule line, with standard SaaS revenue type assignment (Subscription, Platform, Usage, Professional Services, Implementation, Onboarding, Training, Hardware, etc.).

## What already exists
- `live-contract-extract` edge function returns `invoice_schedule[]` with `revenue_type`, `category`, `standalone_selling_price` and writes to `contract_invoice_schedules`.
- `ContractScheduleLines` panel already supports add / edit / delete lines with `CATEGORY_OPTIONS` that include Professional Services, Implementation, etc.
- `Asc606AssessmentDialog` exists for downstream ASC 606 review.

## What's missing
- No explicit nudge after a scan to verify lines — users don't realize Professional Services was missed.
- No AI "second pass" that compares extracted lines against what a SaaS contract typically contains and surfaces likely gaps.

## Changes

### 1. New: Nicolas Line Review banner on `LiveContractDetail`
- A dismissible banner shown when `live_contract_imports.status` is `scanned` / `extracted` AND the user hasn't acknowledged the review yet (track in `live_contract_imports.nicolas_line_review_ack_at`, new nullable timestamp column).
- Banner text: "Nicolas suggests reviewing extracted Order Form lines — Fixed Fee Professional Services, Implementation, and one-time charges are often embedded in pricing tables. Review and add missing lines."
- Actions: "Run Nicolas Line Review" (primary), "I've reviewed — dismiss".

### 2. New edge function: `nicolas-line-review`
- Input: `importId`.
- Loads the contract OCR text (already on `live_contract_imports`) and the current `contract_invoice_schedules` rows.
- Calls Lovable AI (`google/gemini-2.5-flash`) with a focused prompt: identify SaaS Order Form line items that appear in the contract text but are missing or miscategorized in the current schedule lines. Return `{ suggested_additions: [...], suggested_recategorizations: [...], summary: string }` using `Output.object`. Particular emphasis on Fixed Fee Professional Services, Implementation, Setup, Onboarding, Training, Hardware/Travel.
- Returns the structured result to the client (no auto-write — user confirms each).

### 3. New component: `NicolasLineReviewDialog`
- Triggered from the banner.
- Calls `nicolas-line-review`, shows the AI summary plus two tabs:
  - **Suggested additions** — each row pre-filled with description, amount, category, `revenue_type`, billing_type. Checkbox to accept; "Accept selected" inserts into `contract_invoice_schedules` with the chosen revenue type.
  - **Recategorize existing** — shows current line vs. suggested category/revenue_type, accept individually.
- On any accept, invalidate the schedule lines query so `ContractScheduleLines` refreshes.
- Closing the dialog stamps `nicolas_line_review_ack_at`.

### 4. Enhance `ContractScheduleLines` (visibility)
- Add a compact "Revenue mix" summary strip above the table: counts + totals per `revenue_type` (Subscription, Usage, One-time, Professional Services). Makes a missing PS line obvious at a glance.
- Existing add/edit/delete UI stays — already supports all required categories and revenue types.

## Technical details
- DB migration: add `nicolas_line_review_ack_at timestamptz` to `live_contract_imports`.
- Edge function reuses existing CORS + Lovable AI gateway pattern in `_shared`.
- Standard SaaS revenue types used end-to-end:
  `subscription`, `platform`, `license`, `support`, `maintenance`, `usage_minimum`, `prepaid_usage`, `professional_services`, `implementation`, `onboarding`, `training`, `hardware`, `other` — already defined in `CATEGORY_OPTIONS`.
- No changes to the underlying scan pipeline — this is an explicit human-in-the-loop verification layer.

## Files
- `supabase/migrations/<new>.sql` — add column.
- `supabase/functions/nicolas-line-review/index.ts` — new.
- `src/components/clm/NicolasLineReviewBanner.tsx` — new.
- `src/components/clm/NicolasLineReviewDialog.tsx` — new.
- `src/components/clm/ContractScheduleLines.tsx` — add revenue mix summary strip.
- `src/pages/LiveContractDetail.tsx` — render the banner.
