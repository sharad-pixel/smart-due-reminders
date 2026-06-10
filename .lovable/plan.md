# Fix: "Failed to locate duplicate invoice … after insert conflict"

## Root cause
In `supabase/functions/sync-stripe-invoices/index.ts` (~lines 750–779), when the invoice insert hits a unique-constraint violation, the fallback lookup only searches by `invoice_number`. The `invoices` table also has unique constraints on `stripe_invoice_id` and `external_invoice_id` (scoped by `user_id`). When the conflict is triggered by one of those columns — and the existing row's `invoice_number` differs from `stripeInvoice.number || stripeInvoice.id` (e.g. the existing row was created from a CSV/QuickBooks import with a different number, or `stripeInvoice.number` is null and the existing row has a real number) — the lookup returns nothing and we surface the misleading "Failed to locate duplicate invoice" error. That's what's happening for `in_1SnQVqB0u96SjFoIZ6mKuDnf` on the sharad@recouply.ai account.

## Fix
Broaden the duplicate-recovery branch so it finds the existing row by **any** of the three identifiers Stripe sync uses, in priority order, all scoped to `effectiveAccountId`:

1. `stripe_invoice_id = stripeInvoice.id`
2. `external_invoice_id = stripeInvoice.id`
3. `invoice_number = stripeInvoice.number` (only when `stripeInvoice.number` is non-null)

Use a single `.or(...)` query (mirroring the bulk fetch on line 444) that returns at most one row, then update that row with the new `invoiceData` plus `stripe_invoice_id` / `external_invoice_id` so the record becomes the canonical Stripe-linked invoice. If still nothing is found, keep the existing error but include the Postgres constraint name from `insertError.details` so future failures are diagnosable.

Also treat Postgres error `code === '23505'` (not just the message regex) as the duplicate signal, matching project convention (mem://integration/quickbooks-sync-reliability-and-deduplication).

## Scope
Single file edit: `supabase/functions/sync-stripe-invoices/index.ts`, lines ~750–783. No schema changes, no client changes. Idempotent and backward compatible — existing duplicate-by-invoice_number flow still works.

## Verification
After deploy, re-run the Stripe sync from the sharad@recouply.ai account and confirm `in_1SnQVqB0u96SjFoIZ6mKuDnf` reconciles to its existing invoice row instead of erroring.
