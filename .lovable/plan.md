## Goal (this iteration)

Fix the wrong TCVs on Live Contracts and replace the current ad-hoc MRR/ARR/ACV/TCV math with a single finance-grade metrics engine. Clarify how "Revenue Intelligence" wraps Collection Intelligence + Contract Intelligence in the navigation. ASC 606 deep features (recognition schedules, RPO, deferred) remain gated behind the existing paid ASC 606 Compliance Assessment — not built into the free engine.

Out of scope this round: executive dashboards, NRR/GRR/DSO panels, forecasting, validation/approval queue UI, exports to Salesforce/NetSuite/Workday, ASC 606 recognition schedules. Those become follow-up phases.

---

## 1. Platform positioning (nav + labels)

Recouply.ai = **Revenue Intelligence Platform**. Two pillars live under it:

```text
Revenue Intelligence  (top-level umbrella, already a nav group)
├── Collection Intelligence       (existing — Invoices, Payments, Aging, Outreach AI)
└── Contract Intelligence         (this work — Live Contracts, Revenue Risk, CLM)
```

Changes in `src/components/layout/Layout.tsx`:
- Rename the "Revenue Intelligence" dropdown's section label from generic to **"Contract Intelligence"** so the parent dropdown name + child section both read cleanly.
- Items under it: `Live Contracts`, `Revenue Risk`, `CLM Workspaces` (unchanged otherwise).
- No route changes.

This makes the offering self-describing without inventing new pages.

---

## 2. TCV bug — root cause

Confirmed by reading `src/lib/clm/financialMetrics.ts` and the extractor (`live-contract-extract`, `live-contract-approve`):

1. The extractor stores `recurring_fees`, `subscription_fees`, `platform_fees` as **totals over the term** in some contracts and as **monthly/annual rates** in others — the AI prompt doesn't pin the unit.
2. `computeContractTotals` then treats `RECURRING_KEYS` sum as the full-term recurring number (`tcv = recurringSum + oneTimeSum`), which double-counts when the field was already annualized, and undercounts when it was a monthly rate.
3. `arr` derivation does `recurringSum / termYears` — wrong whenever `recurring_fees` was already an annual figure.
4. `Math.max(tcv, ...)` against `contract_value`, `total_value`, `tcv` causes the largest noisy field to win, even when it's clearly a per-period number.
5. Multi-year ramps and quarterly billing are not normalized at all.

---

## 3. New finance-grade metrics engine

Single source of truth: rewrite `src/lib/clm/financialMetrics.ts` and mirror the same logic server-side in a new `supabase/functions/_shared/contractMetrics.ts` (imported by `live-contract-extract`, `live-contract-approve`, `live-contract-actions`).

### 3a. Extractor schema upgrade

In `live-contract-extract` JSON schema, replace flat amount fields with **explicit unit-tagged** fields so the model can't ambiguate:

```text
commercial.recurring_components[]: {
  label, amount, cadence ('monthly'|'quarterly'|'annual'|'one_time'|'term_total'),
  category ('subscription'|'platform'|'support'|'maintenance'|'usage_minimum'|'license'
            |'professional_services'|'implementation'|'onboarding'|'training'|'hardware'|'other'),
  service_period_start, service_period_end
}
commercial.ramp_schedule[]: { year, mrr, arr }   // optional, for ramped deals
commercial.currency
contract.term_months   // canonical term in months
```

Prompt is updated to require cadence + category on every $ line. Legacy flat fields stay accepted for back-compat but are deprecated in scoring.

### 3b. Normalization rules (matches user spec exactly)

For each component, normalize to monthly:
- `monthly` → amount
- `quarterly` → amount / 3
- `annual` → amount / 12
- `term_total` → amount / term_months
- `one_time` → excluded from MRR/ARR/ACV, included in TCV

Recurring categories (count toward MRR/ARR/ACV): `subscription, platform, support, maintenance, usage_minimum, license`.
Non-recurring categories (TCV only): `professional_services, implementation, onboarding, training, hardware, other`.

Formulas:
```text
MRR    = Σ normalized_monthly(recurring components)
ARR    = MRR × 12
ACV    = total_recurring_contract_value / term_years
         (for ramps: weighted_acv, peak_acv, current_acv all returned)
TCV    = total_recurring_contract_value + sum(one_time / non-recurring)
```

`computeContractTotals` returns:
```text
{ mrr, arr, acv, currentAcv, peakAcv, weightedAcv, tcv,
  recurringTcv, servicesTcv, oneTimeTcv,
  currency, termMonths, termYears,
  source: 'components' | 'legacy_fallback' | 'explicit_overrides',
  warnings: string[] }
```

`warnings` surfaces things like "recurring_fees field had ambiguous unit; fell back to invoice_schedule sum".

### 3c. Fallback chain (for already-ingested contracts)

When new component fields are absent (existing 250+ contracts), derive in this order — no more `Math.max` of noisy fields:
1. If `invoice_schedule` exists → group by `billing_type` + `service_period_*`, classify line items via category keyword map, normalize, compute.
2. Else if explicit `mrr`/`arr`/`acv`/`tcv` are present **and internally consistent** (ARR ≈ MRR×12 within 5%) → trust them.
3. Else legacy fee fields, but treat `recurring_fees` as `term_total` only if `term_months > 12`, otherwise `annual`. Emit warning.
4. Never let `contract_value` alone drive TCV unless nothing else exists.

### 3d. Re-extract / recalc

- New edge function `contract-metrics-recompute` (admin/owner only): takes `import_id` or "all for account", re-runs the normalization against current extracted fields + invoice schedule, writes results into `live_contract_extracted_fields` rows with `field_group='metrics'` and `source` metadata. Idempotent.
- Bulk recompute triggered once on deploy via a manual "Recompute metrics" button on `/contracts/live` (admin only).
- New contracts run the engine inside `live-contract-approve` (already the lock point), so MRR/ARR/ACV/TCV become **locked, audited** values from approval onward.

---

## 4. UI changes

`LiveContractDetail.tsx`:
- Replace the existing MRR/ARR/ACV/TCV tiles with engine output. Each tile gets a small info popover showing: components used, cadence assumptions, term, currency, and any `warnings`.
- Add a "Recalculate" button (admin) that calls `contract-metrics-recompute` for this contract.
- When `warnings.length > 0`, show an amber banner: "Some commercial fields were ambiguous — review and approve to lock final values." Links to the existing extracted-fields editor.

`DebtorContractSummaryCard.tsx` + `ContractSummaryCard.tsx`:
- Switch to the new `computeContractTotals` (same import path, same return shape with extra fields → drop-in).

No new pages.

---

## 5. ASC 606 stays paid-only

Confirmed per your answer: performance obligations, recognition schedules, deferred revenue, and RPO are **only** generated when a user pays for / spends credits on the existing ASC 606 Compliance Assessment (`asc606-run-assessment`). Nothing in this plan exposes those for free.

The new metrics engine does, however, output the normalized recurring/non-recurring split that the ASC 606 assessment can consume — so paid assessments get more accurate, faster.

---

## 6. Migration / data work

One migration:
- Add `metrics_jsonb` column on `live_contract_imports` (jsonb, nullable) to cache the engine output + `metrics_computed_at` timestamptz. Avoids recomputing on every render and gives an audit point.
- No table renames, no destructive changes.

Bulk recompute is a one-click admin action, not a migration, so it runs after deploy and we can re-run if needed.

---

## 7. Verification

- Pick 3–5 contracts that currently show wrong TCV (you can point me at IDs after the plan is approved, or I'll surface the worst offenders via a query on `live_contract_imports` where derived TCV ≠ contract_value by >25%).
- For each: compare old vs new MRR/ARR/ACV/TCV with the engine's `warnings` and `source` shown.
- Add unit tests for `computeContractTotals` covering: monthly billing, annual prepaid, 3-year ramp, quarterly + PS, term_total recurring_fees, contract with only `contract_value`.

---

## Follow-up phases (not in this iteration, listed for sequencing)

1. Validation/approval queue UI per extracted field (confidence + source citation + lock).
2. Task auto-generation from renewal/opt-out/POC milestones (extend existing tasks framework).
3. Revenue Intelligence executive dashboard (NRR, GRR, DSO, RPO summary, renewal calendar).
4. Forecasting + revenue waterfall.
5. ERP/BI exports (NetSuite, Workday, Power BI).

Confirm to proceed and, if convenient, drop 1–2 contract IDs with wrong TCVs so I can validate the new engine against them first.