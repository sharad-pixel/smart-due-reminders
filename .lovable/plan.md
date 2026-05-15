## ASC 606 Revenue Risk Assessment — Paid Feature

### Pricing model
- **Per assessment**: $9.99 one-time per contract OR debit 10 credits ($8.00 pre-paid value).
- **Credit wallet** (1 credit = $1.00 post-paid; $0.80 pre-paid):
  - Pre-purchase packs: **25 / 100 / 250 credits** + custom amount (min 10).
  - Overage allowed — usage beyond wallet balance accrues at $1.00/credit and is invoiced monthly via Stripe.
- Restricted to **Owner / Admin** roles per contract account.

### Database (new)
- `asc606_credit_wallets` — one row per account: `account_id`, `balance_credits` (numeric), `lifetime_purchased`, `lifetime_consumed`, `pending_overage_credits` (numeric), `stripe_customer_id`.
- `asc606_credit_ledger` — append-only: `account_id`, `delta` (signed numeric), `kind` ('purchase' | 'consume' | 'overage_accrue' | 'overage_invoice' | 'refund' | 'adjustment'), `contract_id` (nullable), `assessment_id` (nullable), `stripe_payment_intent_id`, `stripe_invoice_id`, `unit_price_cents`, `note`, `created_by`.
- `asc606_assessments` — `contract_id`, `account_id`, `status` ('queued' | 'running' | 'complete' | 'failed'), `report_jsonb`, `report_markdown`, `pdf_storage_path`, `risk_score`, `risk_band`, `model_version`, `cost_credits` (10), `cost_cents` (999), `payment_method` ('credits' | 'stripe_one_time' | 'overage'), `stripe_payment_intent_id`, `requested_by`, `completed_at`, `error`.
- RLS: scoped by account membership; only Owner/Admin can INSERT assessments or trigger purchases. SECURITY DEFINER RPC `consume_asc606_credits(p_account, p_contract, p_amount)` for atomic deduct-or-overage.

### Edge functions (new)
- `asc606-purchase-credits` — Stripe Checkout (mode=payment) for selected pack or custom amount; line item priced at $0.80/credit; metadata `{ kind: 'asc606_credits', credits, account_id }`.
- `asc606-pay-assessment` — Stripe Checkout for $9.99 with metadata `{ kind: 'asc606_assessment', contract_id, account_id }`; success URL triggers `asc606-run-assessment`.
- `asc606-run-assessment` — verifies entitlement (paid PI, sufficient credits, or overage allowed), atomically debits via RPC, calls Lovable AI (Gemini 2.5 Flash) with the contract document + schedule lines + ASC 606 framework prompt → returns structured 5-step revenue recognition report (Identify Contract → POs → Transaction Price → Allocation → Recognize), risk findings, and remediation. Stores JSON + markdown + generates PDF, attaches to contract.
- `asc606-monthly-overage-invoicer` — cron (1st of month UTC); for each wallet with `pending_overage_credits > 0`, creates Stripe invoice item @ $1.00/credit, finalizes invoice, charges card on file, zeroes pending balance, ledgers `overage_invoice`.
- Extend existing `stripe-webhook`:
  - On `checkout.session.completed` for `asc606_credits` → credit wallet, ledger `purchase`.
  - On `checkout.session.completed` for `asc606_assessment` → mark PI as eligible for `asc606-run-assessment` invocation.
  - 23505 dedupe by ledger unique `(stripe_payment_intent_id, kind)`.

### Frontend
- **Contract detail (`LiveContractDetail.tsx`)**: new "ASC 606 Revenue Risk" panel.
  - If no assessment: shows price ($9.99 or 10 credits), wallet balance, `Run Assessment` (admin only) → choice modal:
    - Use credits (if balance ≥ 10) — instant.
    - Pay $9.99 — Stripe Checkout in new tab.
    - Use overage (if no credits & overage enabled) — instant, accrues.
  - If complete: shows risk band/score, 5-step ASC 606 summary, downloadable PDF, "Re-run" option.
  - Past assessments listed with timestamp + cost.
- **New page `/billing/asc606-credits`**: wallet balance, pre-purchase packs (25/100/250 + custom), ledger history, current month's pending overage.
- Sidebar: subtle entry under existing billing section.

### Technical details
- Numeric/decimal types for all credit/cents columns (per project memory).
- Lovable AI: `google/gemini-2.5-flash`, `LOVABLE_API_KEY`. Handle 429/402.
- PDF generation reuses existing report-to-PDF utility if present, else minimal HTML→PDF via edge.
- Cron via `pg_cron` + `pg_net` (insert tool, not migration).
- Cost guard: if AI fails, refund credits / mark assessment `failed`, don't consume.
- Audit log entry per assessment & purchase.

### Out of scope (this iteration)
- Bulk assessment across multiple contracts.
- Custom risk model tuning per industry.
- Credit refunds UI (admin-only ledger adjustment for now).

I'll implement DB → edge functions → webhook extensions → UI in that order. Confirm to proceed.