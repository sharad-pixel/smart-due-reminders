## Goal

Today the app has two parallel billing systems:

1. **Platform Credits** (`asc606_credit_wallets` + `asc606_credit_ledger`) — pre-paid credits with 20% discount, overages settled via `asc606-purchase-credits` (mode=overage). Used by ASC 606 assessments (10 credits/contract) and compliance doc indexing.
2. **AI Smart Ingestion** — pay-per-page Stripe invoicing via `ocr_usage_events` + `ocr_invoice_payments` + the `ai-ingestion-pay-balance` edge function. Charged $1/page directly to a Stripe customer, separate from credits.

The fix: make **Platform Credits the only currency** across the platform. Smart Ingestion (and any future in-app service) draws from the same wallet, accrues into the same `pending_overage_credits` when the balance is empty, and is settled by the same "Pay overage now" flow.

## What changes

### 1. Database / schema

- **No new tables.** `asc606_credit_ledger.service` already exists and is the discriminator (`'asc606'`, `'smart_ingestion'`, future services).
- **Add `'smart_ingestion'` allowed kinds** if needed — current `kind` check allows `consume`, `overage_accrue`, `purchase`, etc., which already cover ingestion. No constraint change required, only the `service` value differs.
- **`consume_asc606_credits` RPC**: extend signature to accept an optional `_service text` (default `'asc606'`) and an optional `_reference_id uuid` / `_note text`. Writes those onto the ledger row it creates. Logic (debit balance → accrue overage if `overage_enabled`) is unchanged.
- **`ocr_usage_events`**: keep as the activity/audit log (per-file, per-page record with timestamps). Stop relying on `stripe_reported` / `payment_id` for billing. Add a nullable `ledger_id uuid` FK to `asc606_credit_ledger` so each scan links to its credit consumption row.
- **`ocr_invoice_payments`** + `ai-ingestion-pay-balance`: deprecate. Existing rows remain readable for history; new scans no longer write here.

### 2. Edge functions

- **`ocr-invoice-upload`** and **`live-contract-extract`** (the two functions that record OCR usage):
  - Replace the direct `ocr_usage_events` insert + Stripe meter call with one call to `consume_asc606_credits({_amount: pageCount, _service: 'smart_ingestion', _reference_id: invoiceId | contractId, _note: fileName})`.
  - Still insert into `ocr_usage_events` for the activity feed, but stamp the returned `ledger_id` and drop the Stripe-meter fields.
  - Return `{ pageCount, creditsCharged, balance_after, overage_accrued }` so the UI can show the impact.
- **`asc606-purchase-credits`** (mode=overage): no logic change — it already settles the full `pending_overage_credits` regardless of which service accrued it. Update the Stripe line-item description from "ASC 606 overage" to "Platform Credits overage settlement" and include a breakdown by service (queried from the ledger) so the invoice line is transparent.
- **`asc606-monthly-overage-invoicer`**: same wording update; no logic change.
- **Delete / 410 `ai-ingestion-pay-balance`**: replace its body with a 410 Gone JSON response telling callers to use `asc606-purchase-credits` (kept around briefly so any open browser tab fails gracefully).

### 3. Frontend

- **`OcrPricingNotice.tsx`**: keep "1 credit / page" copy, change the link/explanation from "Track totals in Settings → Billing" to point at the unified `/billing?tab=credits` and clarify "Drawn from your Platform Credits balance; charged as overage at $1.00/credit if your balance is empty."
- **`IngestionBalanceCard.tsx`**: delete. Anywhere it was rendered (AI Smart Ingestion page), replace with the same unified `CreditsPanel` summary block already used on `/billing?tab=credits` (balance, overage, Buy / Pay-now buttons via `usePayOverage`).
- **`OcrUsageCard.tsx`**: keep, but relabel the "Cost (30d)" tile to "Credits (30d)" and show "$X.XX equivalent" as a sub-line. Remove the "not metered" badge — every row is now backed by a ledger entry.
- **`CreditsPanel.tsx`**: add a second activity sub-tab (or simple service filter) so users can see ASC 606 vs Smart Ingestion vs Compliance Doc consumption from one ledger view. Source is `asc606_credit_ledger` grouped by `service`.
- **`CreditsWalletBadge.tsx`**: no structural change — already reads wallet + overage. Tooltip copy updated to say "Covers ASC 606, Smart Ingestion, and other in-app services."
- **`Billing.tsx` (Credits & Overages tab)**: add a "What credits cover" mini-legend listing the services and their per-unit cost (ASC 606 = 10 credits / contract assessment, Smart Ingestion = 1 credit / page, Compliance Doc Indexing = N credits / doc).
- **All call sites of `ai-ingestion-pay-balance`** (currently the old `IngestionBalanceCard`) → removed alongside that component.

### 4. Pricing / policy copy

- One unified rule, surfaced on the AI Smart Ingestion page, ASC 606 page, and `/billing?tab=credits`:
  - Pre-paid credits: **$0.80/credit** (20% discount).
  - Overage (auto-accrued when balance hits 0): billed at **$1.00/credit**, settled either monthly or via "Pay now".
  - New purchases never retroactively discount past overages.

### 5. Migration of existing data

- One-shot script (run as part of the migration) to:
  - For each historical `ocr_usage_events` row where `stripe_reported = true` → no action (already paid via the old Stripe meter; do NOT also accrue credits).
  - For each row where `stripe_reported = false` AND no `ledger_id` → insert an `asc606_credit_ledger` row with `service='smart_ingestion'`, `kind='overage_accrue'`, `delta=-page_count`, increment the wallet's `pending_overage_credits`, then stamp `ledger_id` back onto the event.
  - Result: any "not metered" pages currently showing in the screenshot become part of the user's overage balance and can be settled by the unified Pay-now button.

## Out of scope

- No changes to credit pricing tiers or the existing Stripe products.
- No change to compliance-doc indexing pricing — it already uses the same wallet.
- No change to ASC 606 assessment cost (still 10 credits).

## Files touched

**Migration**: 1 new SQL migration (extend `consume_asc606_credits`, add `ocr_usage_events.ledger_id`, backfill unpaid events).

**Edge functions**: `ocr-invoice-upload`, `live-contract-extract`, `asc606-purchase-credits` (wording only), `asc606-monthly-overage-invoicer` (wording only), `ai-ingestion-pay-balance` (replace with 410).

**Frontend**:
- Edit: `OcrPricingNotice.tsx`, `OcrUsageCard.tsx`, `CreditsPanel.tsx`, `CreditsWalletBadge.tsx`, `Billing.tsx`, the AI Smart Ingestion page (swap card).
- Delete: `IngestionBalanceCard.tsx`, `usePayOverage.ts` stays (already the unified entry point).

## Risks

- Backfill of legacy unpaid `ocr_usage_events` will move dollars from "Stripe invoice queue" into "credit overage". Need a confirmation prompt before running the migration in production.
- Old browser tabs hitting `ai-ingestion-pay-balance` get a clear 410 with a redirect message — acceptable.
