
## Goal

Turn the Contract Intelligence page (`/contracts/:importId`) into the single source of truth for every contract, organized into 5 explicit, anchored sections. Nothing extracted should be hidden; users can also add custom proactive triggers.

## New page structure

```text
Contract Header (existing)
 ├─ 1. Finance
 ├─ 2. Term & Key Dates
 ├─ 3. Risk
 ├─ 4. Invoicing & Collectibility   ← NEW behavior
 ├─ 5. Custom Triggers              ← NEW
 └─ All Extracted Terms (existing editor, full fields)
```

A sticky in-page nav (anchor links) lets users jump between sections.

## Section details

### 1. Finance
- Reuses existing Financial Summary KPIs: MRR, ARR, ACV, TCV, Services.
- **New:** "Performance Obligations by Service" table built from `contract_invoice_schedules` grouped by `service_name` / `component`, showing recurring vs one-time, total value, recognition pattern (over time / point-in-time), and % of TCV. This is rendered in addition to the existing `ContractValueByYearCard`.
- Includes existing `EditableFinancialTermsCard` (rate, billing frequency, payment terms, etc.).

### 2. Term & Key Dates
- Reuses `ContractTermGauge` and `KeyDatesNotificationsPanel`.
- **Expanded date harvest:** in addition to today's critical dates, surface every date-driven clause from `live_contract_extracted_fields` whose key matches `/date|renewal|notice|termination|opt[_ ]?out|expir|review|true[_ ]?up/i`. Each row shows: label, date, source clause text, and a "Create trigger" button (links into section 5).
- Adds a small "Next 4 critical dates" mini-timeline at the top of the section for fast scanning.

### 3. Risk
- Reuses `ContractRiskFlagsEditor`.
- Adds a header summary chip-row: counts by severity (critical / high / medium / low).
- Adds derived risks not yet in `contract_risk_flags`: schedule-vs-TCV mismatch, missing notice period, auto-renewal without termination right, currency mismatch with debtor, and any extracted field tagged `risk_*`. These are shown as system-detected items that the user can promote into a stored flag with one click.

### 4. Invoicing & Collectibility (new behavior)
Three stacked cards inside one section:

a. **Billing Requirements** — read-only summary distilled from extracted fields: billing frequency, invoice cadence, PO requirement, invoice delivery method/email, late-fee terms, dispute window, payment terms, accepted methods.

b. **Recapture Source-System Invoice** — file upload (PDF/image/CSV) that POSTs to a new edge function `contract-invoice-recapture`. The function:
   - stores the file in the existing `contracts` storage bucket under `recaptured/{importId}/...`,
   - calls Lovable AI Gateway (`google/gemini-2.5-flash`) with vision to extract invoice_number, issue_date, due_date, amount, currency, line items,
   - inserts an `invoices` row (status `Open`) linked to the contract's `debtor_id`, marks `integration_source = 'contract_recapture'`, and triggers existing AI collections workflow automatically (same path used by Smart Ingestion).
   Returns a toast + link to the created invoice.

c. **Upcoming Invoice Backlog (next 60 days excluded)** — table built from `contract_invoice_schedules` where `scheduled_date > now() + 60 days`. Columns: scheduled date, amount, service, status. Lets the finance team see what's queued beyond the 60-day collection window so nothing falls through the cracks.

### 5. Custom Triggers (new)
- New table `contract_custom_triggers` with: `import_id`, `account_id`, `name`, `trigger_type` (`date_offset` | `field_change` | `amount_threshold`), `source_field` (e.g. `renewal_date`, `mrr`, `risk_score`), `offset_days` (nullable), `comparator` (`gt|lt|eq|changed`), `threshold_value` (nullable), `channel` (`email|task|alert`), `recipient_user_id` (nullable), `message`, `is_active`, `last_fired_at`.
- UI: list existing triggers + "New trigger" dialog with a form that adapts to trigger type. Users can pick any extracted date or numeric field from this contract.
- Evaluation: extend the existing scheduled-alerts cron (whichever function powers `KeyDatesNotificationsPanel` reminders) to also evaluate custom triggers daily — creating tasks via `collection_tasks` or sending email via existing transactional sender depending on `channel`.

## Files to add

- `src/components/clm/ContractPageNav.tsx` — sticky anchor nav.
- `src/components/clm/ContractPerformanceObligations.tsx`
- `src/components/clm/ContractBillingRequirements.tsx`
- `src/components/clm/ContractInvoiceRecapture.tsx`
- `src/components/clm/ContractInvoiceBacklog.tsx`
- `src/components/clm/ContractCustomTriggersPanel.tsx` + `NewTriggerDialog.tsx`
- `supabase/functions/contract-invoice-recapture/index.ts`
- Migration for `contract_custom_triggers` (RLS scoped to account membership).

## Files to edit

- `src/pages/LiveContractDetail.tsx` — reorganize JSX into the 5 sections, mount nav, slot new components.
- `src/components/clm/KeyDatesNotificationsPanel.tsx` — add "Create trigger" affordance per row.
- Whatever cron function handles key-date alerts — extend to evaluate custom triggers.

## Out of scope (this iteration)

- Editing the underlying ASC 606 engine.
- Bulk invoice recapture (single-file at a time first).
- SMS/Slack channels for triggers — email + in-app task only.
