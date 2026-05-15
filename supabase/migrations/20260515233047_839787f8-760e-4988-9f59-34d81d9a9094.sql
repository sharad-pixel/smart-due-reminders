-- =========================================================
-- ASC 606 Revenue Risk Assessment — schema
-- =========================================================

-- Wallets: one per account
CREATE TABLE IF NOT EXISTS public.asc606_credit_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE,
  balance_credits numeric(14,2) NOT NULL DEFAULT 0,
  lifetime_purchased numeric(14,2) NOT NULL DEFAULT 0,
  lifetime_consumed numeric(14,2) NOT NULL DEFAULT 0,
  pending_overage_credits numeric(14,2) NOT NULL DEFAULT 0,
  stripe_customer_id text,
  overage_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.asc606_credit_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members view wallet"
  ON public.asc606_credit_wallets FOR SELECT TO authenticated
  USING (public.can_access_account_data(auth.uid(), account_id));

-- All writes via service role only

-- Ledger
CREATE TABLE IF NOT EXISTS public.asc606_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  delta numeric(14,2) NOT NULL,
  kind text NOT NULL CHECK (kind IN ('purchase','consume','overage_accrue','overage_invoice','refund','adjustment')),
  contract_id uuid,
  assessment_id uuid,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  stripe_invoice_id text,
  unit_price_cents integer,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS asc606_ledger_session_unique
  ON public.asc606_credit_ledger(stripe_checkout_session_id, kind)
  WHERE stripe_checkout_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asc606_ledger_account ON public.asc606_credit_ledger(account_id, created_at DESC);
ALTER TABLE public.asc606_credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members view ledger"
  ON public.asc606_credit_ledger FOR SELECT TO authenticated
  USING (public.can_access_account_data(auth.uid(), account_id));

-- Assessments
CREATE TABLE IF NOT EXISTS public.asc606_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','complete','failed')),
  payment_method text CHECK (payment_method IN ('credits','stripe_one_time','overage')),
  cost_credits numeric(14,2) NOT NULL DEFAULT 10,
  cost_cents integer NOT NULL DEFAULT 999,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  report_jsonb jsonb,
  report_markdown text,
  pdf_storage_path text,
  risk_score integer,
  risk_band text,
  model_version text,
  error text,
  requested_by uuid NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asc606_assessments_contract ON public.asc606_assessments(contract_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asc606_assessments_account ON public.asc606_assessments(account_id, created_at DESC);
ALTER TABLE public.asc606_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members view assessments"
  ON public.asc606_assessments FOR SELECT TO authenticated
  USING (public.can_access_account_data(auth.uid(), account_id));

-- Updated_at trigger reuse
DROP TRIGGER IF EXISTS trg_asc606_wallets_updated ON public.asc606_credit_wallets;
CREATE TRIGGER trg_asc606_wallets_updated
  BEFORE UPDATE ON public.asc606_credit_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_asc606_assessments_updated ON public.asc606_assessments;
CREATE TRIGGER trg_asc606_assessments_updated
  BEFORE UPDATE ON public.asc606_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Helper: is_account_admin
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_asc606_admin(_user_id uuid, _account_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_users au
    WHERE au.account_id = _account_id
      AND au.user_id = _user_id
      AND au.status = 'active'
      AND (au.is_owner = true OR au.role IN ('owner','admin'))
  );
$$;

-- =========================================================
-- consume_asc606_credits: atomically deduct credits / overage
-- Returns json { method: 'credits' | 'overage', new_balance, overage_added }
-- =========================================================
CREATE OR REPLACE FUNCTION public.consume_asc606_credits(
  _account_id uuid,
  _amount numeric,
  _contract_id uuid,
  _assessment_id uuid,
  _user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  w public.asc606_credit_wallets%ROWTYPE;
  result jsonb;
BEGIN
  -- Ensure wallet exists & lock row
  INSERT INTO public.asc606_credit_wallets(account_id)
  VALUES (_account_id)
  ON CONFLICT (account_id) DO NOTHING;

  SELECT * INTO w FROM public.asc606_credit_wallets
  WHERE account_id = _account_id FOR UPDATE;

  IF w.balance_credits >= _amount THEN
    UPDATE public.asc606_credit_wallets
       SET balance_credits = balance_credits - _amount,
           lifetime_consumed = lifetime_consumed + _amount
     WHERE account_id = _account_id;

    INSERT INTO public.asc606_credit_ledger(account_id, delta, kind, contract_id, assessment_id, unit_price_cents, created_by, note)
    VALUES (_account_id, -_amount, 'consume', _contract_id, _assessment_id, 80, _user_id, 'ASC 606 assessment');

    result := jsonb_build_object('method','credits','new_balance', w.balance_credits - _amount, 'overage_added', 0);
  ELSIF w.overage_enabled THEN
    UPDATE public.asc606_credit_wallets
       SET pending_overage_credits = pending_overage_credits + _amount,
           lifetime_consumed = lifetime_consumed + _amount
     WHERE account_id = _account_id;

    INSERT INTO public.asc606_credit_ledger(account_id, delta, kind, contract_id, assessment_id, unit_price_cents, created_by, note)
    VALUES (_account_id, -_amount, 'overage_accrue', _contract_id, _assessment_id, 100, _user_id, 'ASC 606 assessment (overage)');

    result := jsonb_build_object('method','overage','new_balance', w.balance_credits, 'overage_added', _amount);
  ELSE
    RAISE EXCEPTION 'Insufficient credits and overage disabled' USING ERRCODE = 'P0001';
  END IF;

  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.consume_asc606_credits(uuid, numeric, uuid, uuid, uuid) FROM public, anon, authenticated;