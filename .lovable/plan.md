# Demo Workspace Manager

Build an admin-only **Demo Mode** for Recouply that lives alongside production. Nothing about existing customer data or flows changes — demo records are tagged with `is_demo = true` and filtered out of normal dashboards.

Not to be confused with the existing marketing `/demo` interactive tour (that stays as-is). This is an in-app admin tool for creating a real, seeded demo workspace you can log into and record from.

---

## 1. Access & Location

- New admin page: `Admin → Demo Mode` at `/admin/demo` (gated by `useFounderAuth`, same as other admin pages).
- Sidebar entry visible only to founder/support users.

## 2. Data Isolation Strategy

Add an `is_demo boolean not null default false` column to the core tables involved in the demo:

- `debtors`, `contacts`, `debtor_contacts`
- `contracts`, `live_contract_imports`, `contract_invoice_schedules`, `contract_stripe_sync`, `contract_stripe_product_map`, `contract_stripe_invoice_link`
- `invoices`, `invoice_line_items`, `payments`, `payment_invoice_links`
- `collection_tasks`, `collection_activities`, `user_alerts`, `ai_assessments`

Rules:
- Global list/dashboard queries add `.eq("is_demo", false)` by default via a shared helper `withDemoFilter(query, { includeDemo })`.
- When the user toggles **View: Demo Workspace** in the top bar, queries flip to `.eq("is_demo", true)`.
- A lightweight `useDemoWorkspace()` context stores the current view mode in `localStorage` and exposes `isDemoView`.
- Reset only ever deletes rows where `is_demo = true` scoped to the current admin user's account. Production data is untouched.

## 3. Admin UI — Demo Workspace Manager

Single page with three sections:

**Status card**
- Workspace exists? counts per entity (customers, contracts, invoices, tasks).
- Stripe test-mode connection status (separate from prod Stripe integration).
- Last seeded / last reset timestamps.

**Actions (each with a confirm modal)**
- Create Demo Workspace
- Load Demo Dataset (full seed)
- Generate Demo Invoices
- Generate Demo Collection Activity
- Reload Demo Insights (recomputes readiness/risk scores)
- Reconnect Stripe Test Account
- Reset Demo Workspace (clear + reseed)
- Clear Demo Data (delete only)

**Seeded entities preview**
- Table of the 5 demo customers with their contract/invoice/ARR snapshot.

## 4. Seed Dataset

Demo team (stored as `debtor_contacts` on an internal "Recouply Demo" org record, purely for display):
Sarah Johnson (CFO), Michael Chen (Controller), Ashley Patel (AR Manager), David Kim (Rev Ops), Emma Rodriguez (CS).

Demo customers:
- **NimbusHR** — full detail (below)
- Atlas Health Network, Velocity Commerce, Global Manufacturing Group, Nova Financial Services — realistic but lighter data (contract + 1–2 invoices + a task each).

**NimbusHR (complete):**
- MSA + Order Form + one Amendment as `live_contract_imports` rows
- Contract Start `2026-01-15`, End `2027-01-14`, Renewal Notice 60d before
- ARR $168,000 · MRR $14,000 · Implementation Services $45,000 · Payment Terms Net 30
- Invoice `INV-1001` — $213,000, open
- Contract Intelligence Score, Billing Readiness Score, Collection Readiness Score (pre-computed, stored)
- Expected cash + collection timeline + 2–3 AI recommendations as `ai_assessments`
- Renewal alert in `user_alerts`

## 5. Stripe Test Mode

- New table `stripe_test_integrations` (mirrors `stripe_integrations` shape, minus prod fields; secret stored encrypted).
- Demo workspace **never** reads `stripe_integrations` — only `stripe_test_integrations`.
- Reject any key not starting with `sk_test_` at save time.
- UI shows a persistent "Stripe Test Mode" chip in the Demo workspace header.
- Billing sync edge functions accept an `is_demo` flag and route to the test integration when true; test customer/product/price/subscription/invoice IDs are stored on the demo records.

## 6. Demo Mode Visual Cues

- When `isDemoView` is true:
  - Amber top-of-page banner: *"This workspace contains fictional demo data for testing and product demonstrations."*
  - "Demo Mode" badge in the main nav next to the logo.
  - Distinct subtle accent color on the sidebar rail so it's unmistakable on video.

## 7. Edge Functions

- `demo-workspace-seed` — creates/re-creates all demo records for the calling admin's account.
- `demo-workspace-reset` — deletes all `is_demo = true` rows scoped to the account, then re-invokes seed.
- `demo-insights-recompute` — regenerates readiness/risk scores and refreshes AI assessment records.
- `demo-generate-invoices` and `demo-generate-collection-activity` — incremental generators for the corresponding buttons.

All are `verify_jwt = false` with in-code JWT validation and admin-role check.

## 8. Technical Details

- Migration adds the `is_demo` columns + partial indexes (`where is_demo = true`) on the hot tables, plus the `stripe_test_integrations` table with GRANTs and RLS.
- Shared helper `src/lib/demoWorkspace.ts` for `isDemoView` context, `withDemoFilter`, and the seed manifest constants (customer list, NimbusHR values) so seed + UI share one source of truth.
- Existing list queries get a one-line `.eq("is_demo", isDemoView)` update; the `useDemoWorkspace` hook toggles the flag globally.
- Nothing about the current marketing `/demo` tour, real Stripe integration, or production dashboards changes.

## 9. Out of Scope (for this pass)

- Recording tooling / video capture.
- Multi-tenant demo workspaces per admin (only one demo workspace per admin account).
- Anonymizing existing production data into demo data.

---

Approve and I'll ship this in order: migration → shared helpers + context → admin page + actions → edge functions + seeder → wire the demo filter into dashboards/lists → Stripe test-mode plumbing.
