
ALTER TABLE public.product_catalog
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS stripe_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS ux_product_catalog_stripe_price
  ON public.product_catalog(user_id, stripe_price_id)
  WHERE stripe_price_id IS NOT NULL;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS pushed_to_stripe_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_push_status text,
  ADD COLUMN IF NOT EXISTS stripe_push_error text;
