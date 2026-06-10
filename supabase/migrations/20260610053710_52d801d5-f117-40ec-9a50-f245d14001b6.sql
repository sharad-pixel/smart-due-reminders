ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS processing_fee_percent numeric(6,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_fee_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal_amount numeric(14,2);

COMMENT ON COLUMN public.invoices.processing_fee_percent IS 'Credit card / payment processing fee percentage applied on top of the invoice subtotal.';
COMMENT ON COLUMN public.invoices.processing_fee_amount IS 'Computed processing fee = subtotal_amount * processing_fee_percent / 100.';
COMMENT ON COLUMN public.invoices.subtotal_amount IS 'Pre-fee invoice amount. When a processing fee is applied, amount = subtotal_amount + processing_fee_amount.';