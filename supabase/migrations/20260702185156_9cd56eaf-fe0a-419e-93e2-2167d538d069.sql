
ALTER TABLE public.debtors ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.debtor_contacts ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.live_contract_imports ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.contract_invoice_schedules ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.contract_stripe_sync ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.contract_stripe_product_map ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.contract_stripe_invoice_link ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.invoice_line_items ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.payment_invoice_links ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.collection_tasks ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.collection_activities ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_alerts ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.ai_assessments ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_debtors_is_demo ON public.debtors(user_id) WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS idx_invoices_is_demo ON public.invoices(user_id) WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS idx_live_contract_imports_is_demo ON public.live_contract_imports(user_id) WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS idx_collection_tasks_is_demo ON public.collection_tasks(user_id) WHERE is_demo = true;

CREATE TABLE IF NOT EXISTS public.stripe_test_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  is_connected boolean NOT NULL DEFAULT false,
  stripe_account_id text,
  stripe_secret_key_encrypted text,
  publishable_key text,
  last_sync_at timestamptz,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_test_integrations TO authenticated;
GRANT ALL ON public.stripe_test_integrations TO service_role;

ALTER TABLE public.stripe_test_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own stripe test integration"
  ON public.stripe_test_integrations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_stripe_test_integrations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_stripe_test_integrations_updated_at ON public.stripe_test_integrations;
CREATE TRIGGER trg_stripe_test_integrations_updated_at
  BEFORE UPDATE ON public.stripe_test_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_stripe_test_integrations_updated_at();

CREATE TABLE IF NOT EXISTS public.demo_workspace_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_exists boolean NOT NULL DEFAULT false,
  last_seeded_at timestamptz,
  last_reset_at timestamptz,
  last_insights_at timestamptz,
  entity_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_workspace_state TO authenticated;
GRANT ALL ON public.demo_workspace_state TO service_role;

ALTER TABLE public.demo_workspace_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own demo workspace state"
  ON public.demo_workspace_state FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_demo_workspace_state_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_demo_workspace_state_updated_at ON public.demo_workspace_state;
CREATE TRIGGER trg_demo_workspace_state_updated_at
  BEFORE UPDATE ON public.demo_workspace_state
  FOR EACH ROW EXECUTE FUNCTION public.update_demo_workspace_state_updated_at();
