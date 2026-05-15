## Goals

1. **Promote AI Smart Ingestion to a top-level tool under "Revenue Intelligence"** — separate it from CLM.
2. **Remove "Live Contracts" from the CLM nav dropdown** — it stays accessible from the AI Tools / AI Smart Ingestion entry point only.
3. **Improve the UI of the ingested-contracts view** (currently the bare "No contracts here" state in the screenshot looks empty and unhelpful).
4. **Surface a total AI Smart Ingestion balance due** with a one-click "Pay now" button.

---

## Part 1 — Re-pillar AI Smart Ingestion

### Nav changes (`src/components/layout/Layout.tsx`)
- Remove `/contracts/live` from `clmItems`. CLM dropdown will only contain `/contracts` (Workspaces).
- Keep the existing **AI Smart Ingestion** entry inside the **AI Tools** dropdown (already there at line 369–375). Update its label/description so it's clear it's a distinct tool, not a CLM feature.
- In the AI Smart Ingestion chooser dialog, after picking **Contracts**, the upload dialog still routes the user to the contract review page at `/contracts/live/:id` — but that page no longer needs the CLM nav context.
- Move route `/contracts/live` and `/contracts/live/:id` so they remain mounted but conceptually under the **Revenue Intelligence** pillar. Add a new persistent landing page **`/ai-ingestion`** (renamed from `/contracts/live`) so URLs reflect the new pillar. Old `/contracts/live` paths get a 301-style redirect to the new URLs to avoid breaking deep links and existing Tasks/alerts.
- Update the `RequireClmAccess` guard on the page → replace with a lighter check that only verifies the user has Revenue Intelligence access (or just authenticated user), so non-CLM users can still use AI Smart Ingestion.

### Files affected
- `src/components/layout/Layout.tsx` — remove from CLM, optional rename of label.
- `src/pages/LiveContracts.tsx` — drop `RequireClmAccess`, rename header to "AI Smart Ingestion — Contracts", update breadcrumb/SEO, keep all existing functionality.
- `src/App.tsx` — add new routes `/ai-ingestion` and `/ai-ingestion/:id` pointing at the same pages, plus redirects from the old `/contracts/live*` paths.
- `src/pages/LiveContractDetail.tsx` — same guard change.
- `src/components/ingestion/SmartIngestionChooserDialog.tsx` and `ContractUploadDialog.tsx` — navigate to `/ai-ingestion/:id` instead of `/contracts/live/:id`.

---

## Part 2 — Improve the ingested-contracts view

The screenshot shows a tabbed UI (Folders / Scan queue / Review / Imported / Audit) where every empty state collapses to a single grey "No contracts here." line. Improvements:

### A. Empty states
Replace the plain text empty state in `ImportsTable` with a richer empty state component:
- Centered icon (Sparkles/FileSearch).
- Tab-specific copy:
  - **Review** → "Nothing waiting for your review. New contracts appear here once AI extracts them."
  - **Scan queue** → "No active scans. Upload a contract or connect a Drive folder to get started."
  - **Imported** → "Nothing imported yet. Approved contracts will live here."
- Two CTAs: **Upload contract** (opens the existing UploadDialog) and **Connect Drive folder** (deep-links to the Folders tab).

### B. Header / hero polish
Above the tabs, replace the current 6-tile widget grid + "Recently Scanned" stack with a cleaner two-row hero:
- Row 1: gradient hero card with title "AI Smart Ingestion — Contracts", short description, primary "Upload Contract" CTA, and the **balance-due summary** (Part 3, see below).
- Row 2: keep the 6 KPI tiles but recolor with semantic tokens, add subtle hover states, and surface a Renewals ≤30d link that filters Imported tab.

### C. Imports table polish
- Add file icon + content type chip (PDF / DOCX) next to the file name.
- Add per-row aging chip ("Scanned 2h ago", "5 days ago") instead of the bare "—".
- Add a row hover action bar (View, Re-scan, Delete) that appears on hover.
- Failed rows: keep the red-tinted background and the inline failure-reason banner already added in a prior turn, but add a **"Retry & view diagnostics"** link that opens the review drawer to the Audit tab.

### D. Review drawer
Add a "Quick stats" strip at the top: pages scanned, confidence score, $ AI cost for this scan, and ARR/MRR if extracted.

---

## Part 3 — Total Ingestion Balance Due + one-click payment

### Data
We already record per-scan usage in `ocr_usage_events` at $0.75/page (see `OcrUsageCard.tsx`). What's missing is a "balance due" concept tied to Stripe metered billing.

Two options for "balance due":
- **Option A (recommended)** — sum of `ocr_usage_events` rows where `stripe_reported = false` for the current account. This is genuinely "unbilled, owed". The "Pay now" button calls a new edge function `ai-ingestion-pay-balance` that creates a Stripe one-off invoice (or PaymentIntent) for that amount and immediately attempts payment using the customer's saved card. On success it marks those events `stripe_reported = true` and stores the Stripe invoice ID.
- **Option B** — just total month-to-date and link to the existing Stripe billing portal; no real "pay now" but simpler.

I'll implement **Option A** because the user explicitly said "push of a button". Fallback: if no saved card, the button opens Stripe Checkout in a new tab.

### Backend changes
- New edge function `ai-ingestion-pay-balance`:
  - Auth: require user JWT, resolve account, sum unbilled `ocr_usage_events`.
  - If amount is 0 → return early.
  - Look up the account's Stripe customer (`stripe_customers` or `account_users` linkage already used by team management).
  - Create a one-off Stripe invoice with a single line item "AI Smart Ingestion — N pages", finalize it, and call `pay()`. Or use a PaymentIntent + ephemeral Checkout session if no payment method on file.
  - On success, mark the source events as `stripe_reported=true`, write a row to `ocr_invoice_payments` (new table) with `stripe_invoice_id`, `amount_cents`, `paid_at`.
  - Return `{ status: 'paid' | 'requires_action', invoice_url, hosted_invoice_url }`.
- New table `ocr_invoice_payments` (numeric amount columns per the financial-precision rule).
- RLS: account-scoped read, only edge function (service role) writes.

### Frontend changes
- New component `IngestionBalanceCard` placed at the top of `/ai-ingestion`:
  - Big number: "$16.50 due" (sum of unbilled events).
  - Subtext: "From 22 pages across 3 scans • last scan 2 days ago".
  - Primary button: **"Pay $16.50 now"** → calls `ai-ingestion-pay-balance`. Disabled when balance is 0; shows a green "All caught up" state instead.
  - Secondary link: "View billing history" → opens a small sheet listing past `ocr_invoice_payments` rows with hosted invoice links.
- Reuse the existing `OcrUsageCard` for the 30-day usage breakdown (stays as supporting info, not the primary balance display).

### Edge cases
- Account on free trial / no Stripe customer yet → "Pay now" button opens the existing checkout flow to add a payment method first, then comes back and pays.
- Concurrent scans during payment → use `FOR UPDATE` locking on the events that get rolled into the invoice so a parallel scan isn't double-billed.
- Failed payment → leave events as `stripe_reported=false`, surface the Stripe error inline, and offer "Retry payment" / "Update card".

---

## Open question

When you say "total ingestion balance due", is it:

- **(A)** What *you* owe Recouply for using AI Smart Ingestion (the $0.75/page OCR usage) — this is what the plan above implements; or
- **(B)** The total **invoiceable balance extracted** from the scanned contracts (i.e. the sum of all upcoming invoice schedule amounts in `contract_invoice_schedules`) so that you can press a button and bulk-generate/send those invoices to your customers?

If it's (B), Part 3 changes to: a "Generate & send N invoices, total $X" button that calls the existing `live-contract-actions/generate_invoices` action across all imported contracts in one shot, then optionally hands them off to the outreach engine.

Let me know A or B and I'll implement.

---

## Technical notes

- All financial columns use `numeric`, never `integer`.
- Edge function follows the standards memory: service-role auth, no module-level cache, CORS headers, `23505` treated as success.
- AI Smart Ingestion remains gated behind subscription / RLS; no change to security posture.
- No CLM-specific tables touched.