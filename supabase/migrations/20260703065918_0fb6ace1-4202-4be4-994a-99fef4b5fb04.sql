
-- Widen contract intake to store richer OCR customer data and per-schedule product mapping.

ALTER TABLE public.live_contract_imports
  ADD COLUMN IF NOT EXISTS extracted_customer_jsonb jsonb;

ALTER TABLE public.contract_invoice_schedules
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.product_catalog(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS pricing_model text,
  ADD COLUMN IF NOT EXISTS billing_period text,
  ADD COLUMN IF NOT EXISTS tax_behavior text,
  ADD COLUMN IF NOT EXISTS tax_category text,
  ADD COLUMN IF NOT EXISTS lookup_key text,
  ADD COLUMN IF NOT EXISTS product_match_confidence integer,
  ADD COLUMN IF NOT EXISTS product_match_status text;

CREATE INDEX IF NOT EXISTS idx_contract_invoice_schedules_product_id
  ON public.contract_invoice_schedules(product_id);
