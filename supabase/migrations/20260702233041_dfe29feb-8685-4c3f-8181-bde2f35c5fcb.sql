-- Drop global unique indexes on Stripe/external invoice IDs so different tenants
-- (or the same tenant re-connecting a new Stripe sandbox) don't collide.
-- Uniqueness is preserved per user via invoices_user_stripe_invoice_id_key and
-- invoices_user_external_invoice_id_key created in migration 20260702222730.
DROP INDEX IF EXISTS public.invoices_stripe_invoice_id_key;
DROP INDEX IF EXISTS public.invoices_external_invoice_id_key;

-- Ensure per-user unique indexes exist (idempotent safety net)
CREATE UNIQUE INDEX IF NOT EXISTS invoices_user_stripe_invoice_id_key
  ON public.invoices (user_id, stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_user_external_invoice_id_key
  ON public.invoices (user_id, external_invoice_id)
  WHERE external_invoice_id IS NOT NULL;