
-- Contract Stripe Billing Sync tables
CREATE TABLE public.contract_stripe_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL UNIQUE REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  organization_id uuid,
  status text NOT NULL DEFAULT 'not_connected',
  readiness_score integer NOT NULL DEFAULT 0,
  blocking_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_subscription_schedule_id text,
  last_sync_at timestamptz,
  last_error jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_stripe_sync TO authenticated;
GRANT ALL ON public.contract_stripe_sync TO service_role;
ALTER TABLE public.contract_stripe_sync ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own contract sync" ON public.contract_stripe_sync FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.contract_stripe_product_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE,
  contract_revenue_item_id uuid REFERENCES public.contract_revenue_items(id) ON DELETE CASCADE,
  product_signature text NOT NULL,
  stripe_product_id text,
  stripe_price_id text,
  mapping_status text NOT NULL DEFAULT 'not_mapped',
  confidence numeric,
  reusable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cspm_signature ON public.contract_stripe_product_map(user_id, product_signature);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_stripe_product_map TO authenticated;
GRANT ALL ON public.contract_stripe_product_map TO service_role;
ALTER TABLE public.contract_stripe_product_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own product map" ON public.contract_stripe_product_map FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.contract_stripe_invoice_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  contract_invoice_schedule_id uuid REFERENCES public.contract_invoice_schedules(id) ON DELETE SET NULL,
  stripe_invoice_id text,
  expected_amount numeric,
  actual_amount numeric,
  variance_type text,
  variance_amount numeric,
  financial_impact numeric,
  recommended_action text,
  ai_confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_stripe_invoice_link TO authenticated;
GRANT ALL ON public.contract_stripe_invoice_link TO service_role;
ALTER TABLE public.contract_stripe_invoice_link ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own invoice link" ON public.contract_stripe_invoice_link FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.contract_stripe_sync_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  action text NOT NULL,
  payload jsonb,
  stripe_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_stripe_sync_events TO authenticated;
GRANT ALL ON public.contract_stripe_sync_events TO service_role;
ALTER TABLE public.contract_stripe_sync_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sync events" ON public.contract_stripe_sync_events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_css_upd BEFORE UPDATE ON public.contract_stripe_sync FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cspm_upd BEFORE UPDATE ON public.contract_stripe_product_map FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_csil_upd BEFORE UPDATE ON public.contract_stripe_invoice_link FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
