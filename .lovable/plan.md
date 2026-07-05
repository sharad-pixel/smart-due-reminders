
# Unified Contract Ingestion & Compliance Wizard

Today users navigate two overlapping surfaces — "AI Ingestion" and "Live Contracts" — plus a separate ASC 606 flow. This plan collapses them into ONE guided wizard that ends on a single Contract Command page. No backend logic is rewritten; we reuse existing edge functions and tables and only reorganize UI + add missing gap-prompts and a Stripe customer push.

## End-state UX

**Contracts Hub** (`/contracts`) keeps only two tabs:
- **Active Contracts** (unchanged list)
- **Ingest a Contract** — launches the new wizard (replaces the "Ingestion & Extraction" tab)

**New wizard** (`/contracts/new`) — a single page, 4 numbered steps with a progress rail:

1. **Upload & Classify** — drag/drop file + contract type (reuses `live-contract-upload`). Shows scan progress with `ScanProgressGauge`.
2. **Review Extracted Data** — shows every field pulled by `live-contract-extract`. Any missing/low-confidence field is highlighted amber with an inline prompt: "Add value" or "Upload supporting doc" (reuses `ContractSupportingDocsPanel`, `live_contract_extracted_fields`). User cannot advance until required gaps are filled or explicitly skipped.
3. **Customer Match** — auto-runs existing `contract_customer_matches` logic.
   - If matched → confirm.
   - If no match → two actions: **Create new customer** (inline form) or **Pick manually** (searchable debtor list, reuses `AssignContractDebtor`).
   - If the account has an active Stripe integration (`useStripeConnected`) AND the customer is new/unlinked → show a **Push to Stripe** panel modeled on the invoice push: checklist of required fields (name, email, address, currency), green ticks / red gaps, single "Create in Stripe" button that calls a new `contract-push-customer-to-stripe` edge function (wraps `stripe.customers.create` + writes `debtors.stripe_customer_id`, mirrors `sync-stripe-customers` upsert logic).
4. **Revenue Compliance Assessment (Paid)** — clear CTA: "Run PwC-governed ASC 606 Revenue Compliance Assessment". Shows credit cost via existing `Asc606ConsolidatedCard` gating, uses `asc606-purchase-credits` if needed, then triggers `asc606-run-assessment`. User can skip; skipping marks the contract as "Assessment pending" on the command page.

On finish → redirect to the **Contract Command page** = existing `LiveContractDetail` (already houses `RevenueComplianceReview`, critical dates, triggers, timeline, chat). No new command page; we just rename the header to "Contract Command" and remove duplicated ASC 606 buttons (they now live only inside `RevenueComplianceReview`).

## Route changes

- `/contracts/new` → new `ContractIngestionWizard.tsx` page.
- `/contracts?hub=ingestion` → 301-style `<Navigate>` to `/contracts/new`.
- `/ai-ingestion` and `/ai-ingestion/:importId` → redirect to `/contracts` and `/contracts/live/:importId` (already the canonical detail route).
- Remove the "Ingestion & Extraction" tab from `ContractsHub`; replace with a prominent "New Contract" button.
- `LiveContracts.tsx` page kept only as an admin/debug list, unlinked from nav.

## Files

**New**
- `src/pages/ContractIngestionWizard.tsx` — 4-step orchestrator, owns `importId` and step state.
- `src/components/contracts/wizard/StepUpload.tsx`
- `src/components/contracts/wizard/StepReviewFields.tsx` — gap detection + inline prompts.
- `src/components/contracts/wizard/StepCustomerMatch.tsx` — match / create / manual / Stripe push panel.
- `src/components/contracts/wizard/StepCompliance.tsx` — paid assessment CTA.
- `src/components/contracts/wizard/WizardRail.tsx` — shared progress rail.
- `src/components/contracts/StripeCustomerPushPanel.tsx` — checklist + push action.
- `supabase/functions/contract-push-customer-to-stripe/index.ts` — creates Stripe customer, links `debtors.stripe_customer_id`, logs to `stripe_sync_log`.

**Edit**
- `src/App.tsx` — routes above.
- `src/pages/ContractsHub.tsx` — drop ingestion tab, add "New Contract" CTA.
- `src/pages/LiveContractDetail.tsx` — header rename to "Contract Command"; remove the redundant "Run ASC 606" top-level button (kept inside `RevenueComplianceReview`).
- `src/components/contracts/ContractUploadDialog.tsx` — deprecate direct navigation to `/ai-ingestion/:id`; instead route into the wizard at the correct step when re-entered.

**Preserved untouched**
- All extraction/assessment edge functions and their prompts (including current-date anchoring).
- `RevenueComplianceReview`, credit wallet, PwC banner, chat.
- Existing debtor/Stripe schema.

## Gap-prompt rules (Step 2)

Required for advance: customer/vendor names, contract start & end dates, total value, billing frequency, currency. Recommended (warns but skippable): renewal notice window, auto-renew flag, POC/pilot flags, termination clauses, key milestones. Each gap row offers: inline edit, "Upload supporting doc" (attaches to `live_contract_supporting_docs` and re-runs extract), or "Mark N/A".

## Out of scope this pass
- Rewriting extraction prompts.
- Bulk-upload wizard (single contract flow only; multi-file upload still lands on the list).
- Removing `LiveContracts.tsx` file (kept as hidden fallback).
