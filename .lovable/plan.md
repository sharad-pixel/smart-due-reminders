## New Pricing Model

Move from "invoices included" to a **platform access fee + included credits + metered add-ons** model. 1 invoice processed/month = 1 credit. Overage matches existing ASC 606 Credits economy ($0.80 pre-paid / $1.00 on-demand).

### Proposed Plans

| Plan | Monthly | Included Credits | Live Contracts Included | Seats Included | Best For |
|---|---|---|---|---|---|
| **Free / Trial** | $0 (7 days) | 5 | 0 | 1 | Evaluation |
| **Launch** | **$29/mo** | 50 credits | 0 (add-on only) | 1 | Solo founders / freelancers |
| **Starter** | **$99/mo** | 150 credits | 5 contracts ($25 value) | 2 | Small AR teams |
| **Growth** ⭐ | **$299/mo** | 500 credits | 20 contracts ($100 value) | 5 | Scaling SaaS / mid-market |
| **Professional** | **$699/mo** | 1,500 credits | 75 contracts ($375 value) | 10 | Established AR ops |
| **Enterprise** | Custom | Custom pool | Custom | Unlimited | Volume / SLA / SSO |

Annual = 20% off (existing convention).

### Add-Ons (à la carte, same across all plans)

- **Live Contracts** — **$5.00 / active contract / month**, metered nightly, pro-rated. Includes alerts + standard risk assessments. Sold as pure add-on; higher plans bundle an allotment that converts to overage at $5/ea above the cap.
- **Credit Top-Ups** (ASC 606 Credits product) — **$0.80/credit pre-paid** packs (100/500/2,000/10,000) or **$1.00/credit on-demand** overage auto-purchased when monthly allotment runs out.
- **Additional Seats** — $75/user/mo (existing).
- **AI Smart Ingestion** — 1 credit/page (already credit-priced — no change).

### What 1 Credit Buys (Credit Economy)

| Action | Credits |
|---|---|
| Invoice processed in a billing cycle (1 invoice = 1 credit, regardless of how many workflow actions fire on it) | 1 |
| AI Smart Ingestion (OCR) | 1 / page |
| ASC 606 Assessment | 1 / assessment |
| Live Contract monitoring | Billed in $ at $5/mo, NOT credits — kept separate so contract value is predictable |

Rationale for 1:1 invoice→credit: matches what the user picked, easy to explain ("Growth = 500 invoices/mo"), and overage just flows through ASC 606 Credits.

### Why This Works as a Twilio-Style Model

1. **Low floor ($29)** removes the pricing objection that blocks small accounts today (current floor is $49 Solo Pro / $199 Starter).
2. **Included credits scale non-linearly** — Growth ($299) gives 500 credits ($1.66/credit effective) vs Launch ($29) giving 50 ($0.58/credit). Heavier users naturally upgrade to lower their effective rate.
3. **Overage never blocks work** — auto pre-purchase at $0.80 or on-demand at $1.00 means accounts never hit a hard wall mid-month.
4. **Contracts is a separate, predictable line item** — easy to forecast for buyers ("100 contracts = $500/mo flat") and decouples CLM revenue from collections volume.
5. **Unified credit currency** across invoices, OCR, ASC 606 → one wallet, one top-up flow, one usage dashboard.

### Implementation Scope

**Stripe (new products/prices):**
- 4 new platform plans (monthly + annual = 8 prices): Launch $29/$278, Starter $99/$950, Growth $299/$2,870, Professional $699/$6,710.
- Reuse existing ASC 606 Credits products (`prod_UeKNmWGVsxDe0E` pre-paid, `prod_UeKNtASW5yOmfV` overage) — already $0.80/$1.00.
- New **Live Contracts** metered product at $5.00/contract/month (usage-record based).
- Keep existing Seat product ($75/mo).
- Legacy Solo Pro / Starter $199 / Growth $499 / Professional $799 prices stay live for grandfathering; remove from checkout UI only.

**Database (`profiles` + new tables):**
- Replace `invoice_limit` semantics with `monthly_credit_allotment` (rename or alias).
- Add `included_contracts` per plan, `active_contract_count` aggregator.
- Reuse `asc606_credit_wallets` + `asc606_credit_ledger` as the unified credit wallet.
- New nightly job: count active live contracts per account → report usage to Stripe meter.

**Code changes:**
- `src/lib/subscriptionConfig.ts` — rewrite `PLAN_CONFIGS` (new tiers, `creditAllotment`, `includedContracts`), update `STRIPE_PRICES`/`STRIPE_PRODUCTS`, deprecate `INVOICE_PRICING.perInvoice` in favor of credit rates.
- `src/pages/Checkout.tsx`, `Pricing.tsx`, `PricingTeaser.tsx`, `Asc606Credits.tsx`, `Billing.tsx` — new plan cards, credit/contract breakdowns, overage explainer.
- `useSubscription.tsx` — expose `creditAllotment`, `includedContracts`, `contractsUsed`.
- New edge function `meter-live-contracts` (nightly cron) — usage records to Stripe.
- Grandfather: existing subscribers keep current invoice limits until they self-migrate; show a one-time "Switch to new credit model" CTA in Billing.

**Migration path for existing customers:**
- Solo Pro ($49, 25 inv) → suggest **Launch + 1 credit pack** or **Starter**.
- Starter ($199, 100 inv) → **Starter** ($99 + overage) or **Growth**.
- Growth ($499, 300 inv) → **Growth** ($299).
- Professional ($799, 500 inv) → **Growth** ($299) or **Professional** ($699).

Most cohorts get cheaper headline pricing with overage exposure — net revenue increases on heavy users via overage and Contracts add-on.

### Phasing

1. **Phase 1 (this PR):** Stripe products/prices created, config + UI updated, new signups land on new model. Legacy plans hidden but functional.
2. **Phase 2:** Live Contracts metering function + Billing dashboard credit/contract usage panels.
3. **Phase 3:** In-app migration wizard for legacy customers + sunset announcement.

Approve and I'll execute Phase 1.