
CREATE TABLE public.product_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid,
  description text NOT NULL,
  unit_type text NOT NULL DEFAULT 'each',
  unit_cost numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  times_used integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_catalog TO authenticated;
GRANT ALL ON public.product_catalog TO service_role;

ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own products" ON public.product_catalog
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own products" ON public.product_catalog
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own products" ON public.product_catalog
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own products" ON public.product_catalog
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE UNIQUE INDEX product_catalog_user_desc_unit_uidx
  ON public.product_catalog (user_id, lower(description), unit_type);

CREATE TRIGGER update_product_catalog_updated_at
  BEFORE UPDATE ON public.product_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.invoice_line_items ADD COLUMN IF NOT EXISTS unit_type text;
