-- Scope external_invoice_id uniqueness per user so the same Stripe invoice
-- can exist under multiple Recouply accounts (each is a separate tenant).
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_external_invoice_id_key;
DROP INDEX IF EXISTS public.invoices_external_invoice_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_user_external_invoice_id_key
  ON public.invoices (user_id, external_invoice_id)
  WHERE external_invoice_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_user_stripe_invoice_id_key
  ON public.invoices (user_id, stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;