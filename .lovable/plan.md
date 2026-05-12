# Contract Staging + Invoice OCR + Team Alerts

## 1. Contract Staging Area

After extraction (`live-contract-extract`), users land on a **Staging tab** in `/contracts/live/:importId` (`LiveContractDetail.tsx`) where they can:
- Review and **edit every extracted field** (term start/end, MRR/ARR/ACV, billing cadence, line items, custom terms) before "publishing"
- Status transitions: `extracted` → `staging` → `published` (existing `live_contract_imports.status` reused; add `staging_completed_at` and `published_at`)
- Once published, contract feeds into Expansion Risk + dashboard contract table (already wired)
- "Discard staging" button reverts to draft

**DB:** add `live_contract_imports.staging_status` (`draft|staging|published`) + `staged_fields` jsonb (overrides on top of `live_contract_extracted_fields`).

## 2. Invoice Attachment to Contract

Inside the contract page, new **"Invoices" tab** with three actions per scheduled billing line:
- **Generate via Recouply** — existing `live-contract-actions` → `generateInvoices` (already does dedupe + line items)
- **Link existing invoice** — searchable picker over the debtor's open invoices; writes `invoice_id` onto `live_contract_invoice_schedules`
- **Upload + OCR** — drag-drop PDF, runs OCR (see §3), creates a new invoice linked to the schedule

**DB:** new column `live_contract_invoice_schedules.attachment_source` (`generated|linked|ocr`) and `ocr_scanned_file_id` reference.

## 3. OCR Upload with $0.75/page Metered Billing

**New edge function `ocr-invoice-upload`:**
- Accepts a PDF file (base64 or storage path), runs the same Gemini-2.5-Flash extraction logic from `extract-invoice-pdf` (page-count detection already exists)
- On success, records a usage row in **new table `ocr_usage_events`** (`user_id`, `account_id`, `file_name`, `page_count`, `unit_price_cents=75`, `total_cents`, `stripe_meter_event_id`, `contract_id`, `invoice_id`)
- Reports the page count to Stripe via metered billing (Step 4)
- Creates an invoice draft for the user to review, optionally pre-attached to a contract schedule

**UI: `OcrPricingNotice` component** — shown wherever OCR is offered (smart ingestion, contract upload, new contract-invoice OCR uploader, existing scan flows). One-line callout: *"OCR scanning is billed at $0.75 per page. You'll see usage in Settings → Billing."* Surfaces estimated cost ("~$X.XX for an N-page document") after page count is detected.

## 4. Stripe Metered Billing for OCR

- Create a **new Stripe metered product**: "OCR Scanning" at $0.75/page, billing meter `ocr_pages`
- After `ocr-invoice-upload` succeeds, edge function calls `stripe.billing.meterEvents.create({ event_name: 'ocr_pages', payload: { stripe_customer_id, value: pageCount } })`
- Customers are auto-resolved by the existing subscription customer mapping (`useSubscription`)
- New **Settings → Billing → OCR Usage** section shows month-to-date pages + $ from `ocr_usage_events`
- Failures to report to Stripe are logged but do not fail the OCR (we always store the local `ocr_usage_events` row → reconciliation source of truth)

## 5. In-App Notifications (no email)

Reuse existing `useUserAlerts` / `AlertNotifications` system. Trigger an alert (`alert_type='contract_event'`, deep-link to `/contracts/live/:importId`) when:
- Contract enters staging (notify the uploader + any added watchers)
- Contract is published
- Invoice generated / linked / OCR-attached on a contract
- OCR upload completes (with cost summary)

**Watchers:** new table `live_contract_watchers (contract_id, user_id, added_by, created_at)`. Inside the contract page, an "Alerts" panel lets the owner add other team members from `account_users`. Each watcher receives in-app alerts for the events above.

## Files

**New**
- `supabase/functions/ocr-invoice-upload/index.ts` — OCR + meter reporting
- `src/components/clm/ContractStagingPanel.tsx` — editable extracted fields
- `src/components/clm/ContractInvoicesTab.tsx` — generate / link / OCR
- `src/components/clm/ContractWatchersPanel.tsx` — manage alert recipients
- `src/components/ocr/OcrPricingNotice.tsx` — reusable $0.75/page disclosure
- `src/components/billing/OcrUsageCard.tsx` — month-to-date usage in Settings
- `src/lib/supabase/contractWatchers.ts`, `src/lib/supabase/ocrUsage.ts`

**Edited**
- `src/pages/LiveContractDetail.tsx` — add Staging / Invoices / Alerts tabs
- `supabase/functions/live-contract-actions/index.ts` — emit watcher alerts on generate/link
- `supabase/functions/extract-invoice-pdf/index.ts` — add OCR pricing meter call (existing scanner) + record `ocr_usage_events`
- `src/components/data-center/ingestion/*` — show `OcrPricingNotice` wherever upload-to-OCR is offered
- `src/pages/Settings.tsx` (Billing) — mount `OcrUsageCard`

## Database migrations

```text
ocr_usage_events (id, user_id, account_id, file_name, page_count,
  unit_price_cents int default 75, total_cents int, stripe_meter_event_id,
  contract_id uuid null, invoice_id uuid null, source text, created_at)
  + RLS: user can read own / account members can read account rows

live_contract_watchers (id, contract_id, user_id, added_by, created_at)
  unique(contract_id, user_id) + RLS scoped to account members

live_contract_imports add: staging_status text default 'draft',
  staged_fields jsonb, staging_completed_at, published_at

live_contract_invoice_schedules add: attachment_source text,
  ocr_scanned_file_id uuid null
```

## Stripe setup (required from you)

I'll create the Stripe product + metered price `ocr_pages` at $0.75/page. You won't need to do anything manually — Lovable Cloud already has Stripe enabled.

## Out of scope (this pass)

- Email notifications (you chose in-app only)
- Cross-contract OCR analytics dashboard
- Bulk OCR uploads (single-file at a time first)

Reply "go" to build, or tell me what to change.