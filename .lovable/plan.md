## Goal

Make the line-item / product structure on imported contracts classification-aware (SaaS / Software vs Professional Services, etc.), let users override every extracted field (including the new category), and upgrade Key Dates to cover Term Start, Term End, Non-Renewal Notice Period, and a derived Opt-Out Date — with email notifications, not just in-app alerts.

---

## 1. Database changes (one migration)

`contract_invoice_schedules`
- Add `product_category text` — values: `subscription`, `platform`, `license`, `support`, `maintenance`, `usage_minimum`, `professional_services`, `implementation`, `onboarding`, `training`, `hardware`, `other`.
- Add `revenue_type text` — `recurring` | `non_recurring` (derived from `product_category` but persisted so finance can override independently when needed).
- Add `category_source text` — `extracted` | `industry_default` | `user`.

`live_contract_imports`
- Add `industry text` (nullable) — captured at import; used as the fallback for category inference.

`contract_critical_dates`
- Add `notify_emails text[]` (recipients in addition to the owner) and `notify_channel text` default `'in_app'`, allowed values `in_app`, `email`, `both`.
- Backfill `date_type` accepted values to also include `term_start` and `notice_period_start` (no constraint exists today, so this is just a docs note).

No destructive changes; all new columns nullable / defaulted.

---

## 2. Server: classification + key-date logic

### `supabase/functions/_shared/contractMetrics.ts`
- Export `classifyLineItem({ description, billing_type, industry })` reusing the existing `classifyByKeyword` map and falling back to industry rules:
  - SaaS / Software industry → default `subscription` (recurring)
  - Professional Services industry → default `professional_services` (non-recurring)
  - Hardware / Manufacturing → default `hardware` (non-recurring)
  - Otherwise → `null` (means UI must prompt user)
- Helper `revenueTypeFor(category)` → `recurring` for the existing `RECURRING_CATEGORIES`, else `non_recurring`.

### `live-contract-extract` and `live-contract-approve`
- On each `invoice_schedule` row written, populate `product_category` from the extractor (already returns `category` in components) or `classifyLineItem` fallback, and set `category_source = 'extracted'` when the model returned one, else `'industry_default'` when industry rule fired, else leave NULL (user must pick).
- Stamp `revenue_type` from `revenueTypeFor`.
- Persist contract `industry` onto `live_contract_imports.industry` from the extractor (it already produces this in `business`/`contract` fields).

### `live-contract-actions` — `action: "recalculate_dates"`
- Already emits `effective_date`, `term_end`, `renewal`, `opt_out_deadline`. Add:
  - `term_start` (alias of effective when present — kept as its own row so it can have its own notifications).
  - `non_renewal_notice_start` = `renewal_date - notice_period_days` (same math as opt_out but labeled distinctly so the user can have a "begin drafting non-renewal letter" reminder before the hard opt-out cutoff). When the extractor gives only `opt_out_deadline`, derive `notice_window_start = opt_out - notice_period_days` if `notice_period_days` exists.
- Keep existing dedupe and risk leveling.

### New action: `action: "send_test_notification"` and a real cron worker
- Add edge function `contract-key-date-notifier` (scheduled daily): scans `contract_critical_dates` where `alert_enabled=true`, `due_date - alert_lead_days <= today`, and `last_alerted_at IS NULL` (or older than 7 days for repeats). For each row:
  - In-app alert (same as today's inline code).
  - If `notify_channel IN ('email','both')`, send via existing branded email renderer to the contract owner + `notify_emails[]` with subject like "Action needed: Non-renewal notice window opens in N days" and a deep link to the contract.
- Register in `supabase/config.toml` cron section.

### `set_alerts` action
- Accept `{id, enabled, lead_days, channel, emails}` and persist `notify_channel` + `notify_emails`.

---

## 3. Client UI

### `ContractScheduleLines.tsx`
- New "Category" column showing a colored chip (Recurring = emerald, Non-recurring = slate) with the category label.
- Edit dialog adds:
  - `Category` select (full list above).
  - `Revenue type` select (auto-set from category but overridable, with a tooltip explaining ASC 606 implication).
  - A small "Industry default" hint when `category_source = 'industry_default'`.
- When a row's `product_category` is NULL after import, render an amber inline "Pick a category" button that opens the dialog focused on the select.

### `KeyDatesNotificationsPanel.tsx`
- Show all five date types (Term Start, Term End, Non-Renewal Notice Period start, Opt-Out Deadline, Renewal) with a label map.
- Each row gains:
  - Channel toggle: `In-app` / `Email` / `Both`.
  - Email recipients input (chip-style, comma separated, validated).
- "Send test notification" button next to Save that calls `send_test_notification` for the configured row so the user can verify delivery.

### Contract overview (already editable)
- Add `Industry` field to `ContractOverviewEditor` so users can correct the fallback that drives category inference, and a "Re-classify line items" button that re-runs `classifyLineItem` over existing schedule rows where `category_source != 'user'`.

---

## 4. Verification

- Upload one SaaS MSA + one Professional Services SOW.
- Confirm SaaS lines come back with `subscription` / `recurring`; PS lines come back with `professional_services` / `non_recurring`.
- For a contract with no obvious category in extraction, confirm the row shows the amber "Pick a category" prompt and the category persists after editing.
- Enable email alert on the new "Non-Renewal Notice Period" row with 30-day lead and a test recipient, hit "Send test notification", confirm email arrives.
- Run the cron once manually via curl and verify only due rows fire.

---

## Out of scope (call out, do not build)

- Pushing categories back to ERP / Salesforce.
- Per-line tax handling.
- Multi-currency revenue type split.

Proceed?