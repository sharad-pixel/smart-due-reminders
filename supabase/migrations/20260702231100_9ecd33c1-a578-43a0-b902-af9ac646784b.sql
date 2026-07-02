
ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.product_catalog(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_description text,
  ADD COLUMN IF NOT EXISTS pricing_model text,
  ADD COLUMN IF NOT EXISTS billing_period text,
  ADD COLUMN IF NOT EXISTS tax_behavior text,
  ADD COLUMN IF NOT EXISTS tax_category text,
  ADD COLUMN IF NOT EXISTS lookup_key text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_product_id ON public.invoice_line_items(product_id);
