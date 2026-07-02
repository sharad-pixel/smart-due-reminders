## Stripe Billing Sync — Contract Intelligence Extension

Extend (not replace) the existing Contract Intelligence workspace and Stripe integration. When a customer has Stripe connected, approved commercial terms extracted by Contract Intelligence can flow into Stripe Billing objects with full traceability. Customers without Stripe see no change.

### Scope guardrails
- Reuse `contracts`, `contract_revenue_items`, `contract_invoice_schedules`, `contract_extracted_fields`, `product_catalog`, `stripe_integrations`, and existing sync functions (`sync-stripe-invoices`, `stripe-webhook`).
- No new billing engine, no duplicated contract extraction, no changes to Collection Intelligence internals — only add associations.
- Gate the entire feature on: Stripe connected (`stripe_integrations` row active) + user has Billing permission.

### 1. Data model (one migration)
New tables (all with GRANTs + RLS scoped by `auth.uid()` / org):
- `contract_stripe_sync` — 1:1 with contract. Fields: contract_id, status (`not_connected|ready|pending_review|ready_for_stripe|synchronized|error|needs_attention`), readiness_score, blocking_issues jsonb, last_sync_at, stripe_customer_id, stripe_subscription_id, stripe_subscription_schedule_id, error jsonb.
- `contract_stripe_product_map` — contract_revenue_item_id → stripe_product_id, stripe_price_id, mapping_status, confidence, reusable flag. Unique on (org, revenue_item signature) so mappings auto-apply to future contracts.
- `contract_stripe_invoice_link` — link contract/schedule row → stripe_invoice_id + variance data (expected_amount, actual_amount, variance_type, financial_impact, recommended_action, ai_confidence).
- `contract_stripe_sync_events` — audit trail (action, actor, payload, stripe_response).

### 2. New "Billing Sync" tab in Contract Workspace
Add `billing-sync` entry to `ContractPageNav` (only rendered when Stripe connected). New section component `ContractStripeBillingSync.tsx` mounted in `LiveContractDetail.tsx`, containing four cards:

**a. Sync Status Card** — badge + Last Sync, Stripe Account, Readiness Score, primary action button (Review / Sync / Resolve).

**b. AI Billing Readiness** — reuses already-extracted fields (customer, products, pricing, frequency, term, dates, currency, payment terms, invoice schedule, prof services, usage, discounts, taxes, PO). Client-side checklist that computes score % and lists blockers. No re-entry of data.

**c. Stripe Product Mapping** — table of contract products vs Stripe catalog. Row actions: Map Existing / Create Product / Create Price / Ignore. Auto-suggest matches via fuzzy name + amount. Save Mapping persists to `contract_stripe_product_map` for reuse.

**d. Billing Preview** — computed from extracted terms: recurring subs, one-time, implementation, prof services, usage, discounts, frequency, invoice schedule, ARR/MRR/ACV/TCV. Read-only preview before "Sync to Stripe".

### 3. Edge functions (new, additive)
- `stripe-billing-readiness` — computes score + blockers for a contract (server-side so it can also power dashboard aggregates).
- `stripe-catalog-match` — pulls Stripe products/prices, returns suggested mappings.
- `stripe-billing-sync` — the executor. Creates/updates Stripe Customer, Products, Prices, Subscription, Subscription Schedule, Invoice Items, Draft Invoices as required by the contract's billing model. Writes IDs back to `contract_stripe_sync` and the mapping tables. Idempotent per contract.
- `stripe-invoice-variance-scan` — continuously compares Stripe invoices with the contract's expected schedule; writes into `contract_stripe_invoice_link` with variance types (missing, wrong amount, wrong frequency, prof services not billed, usage missing, duplicate, unexpected, post-expiration). Wire to existing `stripe-webhook` and to the scheduled sync.

### 4. Collection Intelligence association (no behavior change)
- Extend `stripe-webhook` and `sync-stripe-invoices` so that when an invoice is upserted, if its Stripe subscription/invoice ID matches a `contract_stripe_sync` record, populate `invoices.contract_id` (and order form / customer references). No new invoice rows created; existing dedup logic stands.

### 5. Executive Dashboard
Conditional metrics block (only when Stripe connected) on `ContractIntelligenceDashboard.tsx`:
Contracts Ready for Billing · Contracts Synchronized · Invoices Generated · Invoices Missing · Products Not Mapped · Billing Exceptions · Revenue Waiting for Billing · Billing Coverage · Avg Readiness Score · Stripe Sync Health.

### 6. AI Recommendations → Task Center
`stripe-billing-readiness` and `stripe-invoice-variance-scan` emit recommendations (map product, create price, generate invoice, create schedule, fix amount, missing customer, etc.). Each becomes an optional row in the existing `collection_tasks` (or contract task) table, tagged `source='billing_sync'`, deep-linked back to the Billing Sync tab.

### 7. Feature gating
- `useStripeConnected()` hook checks `stripe_integrations` for the user's org.
- Billing Sync tab, dashboard metrics, and task creation are all no-ops when not connected. Existing flows unchanged.

### Files touched
New:
- `supabase/migrations/<ts>_contract_stripe_billing_sync.sql`
- `supabase/functions/stripe-billing-readiness/index.ts`
- `supabase/functions/stripe-catalog-match/index.ts`
- `supabase/functions/stripe-billing-sync/index.ts`
- `supabase/functions/stripe-invoice-variance-scan/index.ts`
- `src/components/clm/billing-sync/ContractStripeBillingSync.tsx`
- `src/components/clm/billing-sync/BillingSyncStatusCard.tsx`
- `src/components/clm/billing-sync/BillingReadinessCard.tsx`
- `src/components/clm/billing-sync/StripeProductMappingCard.tsx`
- `src/components/clm/billing-sync/BillingPreviewCard.tsx`
- `src/hooks/useStripeConnected.ts`
- `src/hooks/useContractBillingSync.ts`

Edited:
- `src/components/clm/ContractPageNav.tsx` (conditional Billing Sync entry)
- `src/pages/LiveContractDetail.tsx` (mount new section)
- `src/pages/ContractIntelligenceDashboard.tsx` (conditional metrics block)
- `supabase/functions/stripe-webhook/index.ts` + `sync-stripe-invoices/index.ts` (contract association + variance trigger)

### Open questions before I build
1. Which existing table is the source of truth for "org / account" scoping on contracts — `organizations` or `account_users`? I'll match whatever pattern `contracts` uses today.
2. Should "Sync to Stripe" default to **draft** invoices/subscriptions (safer) or activate them immediately?
3. For Billing permission gating, reuse an existing role (e.g. admin) or add a new `billing_sync` capability on `user_roles`?