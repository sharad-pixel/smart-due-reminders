## Goal

Fix the overlapping Credits chip vs AI Tools by consolidating the top nav, and merge `/billing`, `/billing/asc606-credits`, `/team` (billing pieces) and `/upgrade` into one unified **Subscription & Billing** page where users see plan, seats, credits, overages, and pay everything in one place.

---

## 1. Nav bar consolidation (fix overlap)

Current desktop nav: `RevenueHub ▾` · `Accounts` · `Data Center` · `Contract Intelligence ▾` · `AI Tools ▾` + right side `Credits chip` · `Alerts` · `Avatar`. On ~1280–1500px the Credits chip collides with `AI Tools`.

Changes in `src/components/layout/Layout.tsx`:

- **Merge `Contract Intelligence` into `RevenueHub`** as a categorized mega-dropdown:
  ```
  RevenueHub ▾
    Overview
    — Collection Intelligence —
      Invoices
      Payments
    — Contract Intelligence —
      Live Contracts
      Revenue Risk
      CLM Workspaces (if clmActive)
  ```
  Active state = any of the merged routes. Remove the standalone `Contract Intelligence` dropdown trigger.
- Keep `Accounts`, `Data Center`, `AI Tools ▾` as siblings. Result: 4 top-level items instead of 5.
- Tighten right-side spacing: reduce `CreditsWalletBadge` to compact mode (`12 · −$10` icon-only when net is negative, hide the `credits` word at <1400px) and use `gap-1` instead of `space-x-2`.
- Mobile sheet: keep the same Collection/Contract section labels under one "RevenueHub" group.

## 2. Unified Subscription & Billing page

New route: **`/billing`** (replaces current `/billing` and supersedes `/billing/asc606-credits` and `/upgrade`). Single page with anchor tabs:

```
[ Plan & Subscription ] [ Team & Seats ] [ Credits & Usage ] [ Invoices & Receipts ]
```

Sections (single page, sticky tab bar for in-page nav):

1. **Plan & Subscription** — current plan, status, renewal date, plan comparison + upgrade/downgrade CTA (port from `Billing.tsx` + `/upgrade`). "Manage in Stripe portal" button.
2. **Team & Seats** — billable seats, active members, pending invites, add/remove member, role chips. Port the billing portion of `/team` into a panel; keep `/team` page for admin-only member CRUD but link in/out.
3. **Credits & Usage** — port everything from `Asc606Credits.tsx`: wallet stats, overage card with **Pay now**, packs, custom amount, policy disclaimer, ledger, AI Smart Ingestion usage card.
4. **Invoices & Receipts** — Stripe invoice history (already in `Billing.tsx`).

Implementation:
- Create `src/pages/SubscriptionBilling.tsx` composed of sub-components extracted from existing pages (no logic rewrite — re-use existing components: `OcrUsageCard`, `UsageBillingLog`, `ConsumptionTracker`, plus new `CreditsPanel`, `PlanPanel`, `SeatsPanel`).
- Route `/billing` → `SubscriptionBilling`. Add redirects:
  - `/billing/asc606-credits` → `/billing?tab=credits`
  - `/upgrade` → `/billing?tab=plan`
- Delete the standalone `Asc606Credits` page once redirect is verified (keep file as thin re-export for one release if safer).

## 3. Pay-now everywhere cost is shown

Surface the existing `payOverage` flow (already implemented via `asc606-purchase-credits` with `mode: "overage"`) wherever a user sees outstanding cost:

- **CreditsWalletBadge tooltip**: add `Pay $X.XX now` button when `overage > 0` (small inline button, opens Stripe checkout in new tab via `supabase.functions.invoke("asc606-purchase-credits", { body: { mode: "overage", accountId } })`).
- **Profile dropdown**: when `overage > 0`, show an amber "Outstanding: $X.XX — Pay now" row above "Billing & Credits".
- **AI Smart Ingestion usage card**: add a `Pay now` button next to the 30-day cost when overage exists.
- Extract a single `usePayOverage(accountId)` hook in `src/hooks/usePayOverage.ts` so all three entry points share one implementation.

## 4. Update member-area links

Anywhere these old paths are referenced, point to the unified page:
- `/billing/asc606-credits` → `/billing?tab=credits`
- `/upgrade` → `/billing?tab=plan`
- Profile dropdown "Billing & Credits" → `/billing`
- Team page "Manage billing" → `/billing?tab=seats`
- Trial banner / lockout banner CTAs → `/billing?tab=plan`
- Onboarding "Add billing" missing-item → `/billing?tab=plan`

Search & replace across `src/` for the two old paths.

---

## Technical notes

- No DB or edge function changes required; `asc606-purchase-credits` already supports `mode: "overage"` and `stripe-webhook` already credits `pending_overage_credits` on success.
- Tabs driven by `?tab=` query param using `useSearchParams` so deep links work.
- Keep `Asc606Credits.tsx` content intact during extraction — move JSX into `src/components/billing/panels/CreditsPanel.tsx` and import from both the new unified page and (temporarily) the redirect shim.
- Responsive: at <1024px nav collapses to existing mobile sheet — no change needed beyond inserting the new categorized groups.

## Files touched

- `src/components/layout/Layout.tsx` — merged dropdown, compact credits chip, overage row in profile menu
- `src/components/billing/CreditsWalletBadge.tsx` — inline Pay now button in tooltip
- `src/pages/SubscriptionBilling.tsx` (new)
- `src/components/billing/panels/{PlanPanel,SeatsPanel,CreditsPanel,InvoicesPanel}.tsx` (new, extracted)
- `src/hooks/usePayOverage.ts` (new)
- `src/App.tsx` — route + redirects
- Link updates across pages referencing old billing paths
