
ALTER TABLE public.product_catalog
  ADD COLUMN IF NOT EXISTS pricing_model text NOT NULL DEFAULT 'one_off',
  ADD COLUMN IF NOT EXISTS billing_period text,
  ADD COLUMN IF NOT EXISTS tax_behavior text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS tax_category text,
  ADD COLUMN IF NOT EXISTS price_description text,
  ADD COLUMN IF NOT EXISTS lookup_key text,
  ADD COLUMN IF NOT EXISTS image_url text;

DO $$ BEGIN
  ALTER TABLE public.product_catalog
    ADD CONSTRAINT product_catalog_pricing_model_chk
    CHECK (pricing_model IN ('recurring','one_off'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.product_catalog
    ADD CONSTRAINT product_catalog_tax_behavior_chk
    CHECK (tax_behavior IN ('auto','inclusive','exclusive'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.product_catalog
    ADD CONSTRAINT product_catalog_billing_period_chk
    CHECK (billing_period IS NULL OR billing_period IN ('daily','weekly','monthly','quarterly','yearly'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS product_catalog_user_lookup_key_uidx
  ON public.product_catalog(user_id, lookup_key)
  WHERE lookup_key IS NOT NULL;
