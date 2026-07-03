-- Live Contracts monthly usage tracking (metered $5/contract/mo)
CREATE TABLE IF NOT EXISTS public.live_contract_usage_monthly (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NULL,
  period_month DATE NOT NULL, -- first day of month (UTC)
  plan_type TEXT NULL,
  included_contracts INTEGER NOT NULL DEFAULT 0,
  active_contracts INTEGER NOT NULL DEFAULT 0,
  billable_contracts INTEGER NOT NULL DEFAULT 0,
  unit_price_cents INTEGER NOT NULL DEFAULT 500,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  last_synced_stripe_at TIMESTAMPTZ NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_contract_usage_monthly TO authenticated;
GRANT ALL ON public.live_contract_usage_monthly TO service_role;

ALTER TABLE public.live_contract_usage_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own live contract usage"
  ON public.live_contract_usage_monthly FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own live contract usage"
  ON public.live_contract_usage_monthly FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own live contract usage"
  ON public.live_contract_usage_monthly FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages all live contract usage"
  ON public.live_contract_usage_monthly FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER trg_live_contract_usage_updated_at
  BEFORE UPDATE ON public.live_contract_usage_monthly
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_live_contract_usage_period
  ON public.live_contract_usage_monthly (period_month DESC);
CREATE INDEX IF NOT EXISTS idx_live_contract_usage_user_period
  ON public.live_contract_usage_monthly (user_id, period_month DESC);

-- RPC: recompute current-month live contract usage for the calling user.
-- Counts distinct approved/active live_contract_imports for the user's org,
-- applies plan-included allotment, and upserts the monthly row at $5/contract.
CREATE OR REPLACE FUNCTION public.recompute_live_contract_usage(_user_id UUID DEFAULT auth.uid())
RETURNS public.live_contract_usage_monthly
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period DATE := date_trunc('month', now())::date;
  v_active INTEGER := 0;
  v_plan TEXT;
  v_included INTEGER := 0;
  v_billable INTEGER := 0;
  v_amount INTEGER := 0;
  v_row public.live_contract_usage_monthly;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  SELECT COALESCE(plan_type, 'launch')
    INTO v_plan
    FROM public.profiles
   WHERE id = _user_id;

  v_included := CASE v_plan
    WHEN 'starter' THEN 5
    WHEN 'growth' THEN 20
    WHEN 'professional' THEN 75
    WHEN 'enterprise' THEN 2147483647
    ELSE 0
  END;

  SELECT COUNT(*)::int
    INTO v_active
    FROM public.live_contract_imports lci
   WHERE lci.user_id = _user_id
     AND COALESCE(lci.status, '') NOT IN ('archived','rejected','deleted','duplicate');

  v_billable := GREATEST(0, v_active - v_included);
  v_amount := v_billable * 500; -- $5.00 in cents

  INSERT INTO public.live_contract_usage_monthly
    (user_id, period_month, plan_type, included_contracts,
     active_contracts, billable_contracts, unit_price_cents, amount_cents)
  VALUES
    (_user_id, v_period, v_plan, v_included,
     v_active, v_billable, 500, v_amount)
  ON CONFLICT (user_id, period_month) DO UPDATE
    SET plan_type = EXCLUDED.plan_type,
        included_contracts = EXCLUDED.included_contracts,
        active_contracts = EXCLUDED.active_contracts,
        billable_contracts = EXCLUDED.billable_contracts,
        unit_price_cents = EXCLUDED.unit_price_cents,
        amount_cents = EXCLUDED.amount_cents,
        computed_at = now(),
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_live_contract_usage(UUID) TO authenticated, service_role;