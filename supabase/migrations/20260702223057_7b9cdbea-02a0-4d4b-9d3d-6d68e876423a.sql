-- Roll back the per-user indexes added previously
DROP INDEX IF EXISTS public.invoices_user_external_invoice_id_key;
DROP INDEX IF EXISTS public.invoices_user_stripe_invoice_id_key;

-- Restore the strict global uniqueness (partial index so NULLs remain allowed)
CREATE UNIQUE INDEX IF NOT EXISTS invoices_external_invoice_id_key
  ON public.invoices (external_invoice_id)
  WHERE external_invoice_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_stripe_invoice_id_key
  ON public.invoices (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;