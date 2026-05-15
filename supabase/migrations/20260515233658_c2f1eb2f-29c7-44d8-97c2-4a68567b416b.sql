-- Generalize ledger for cross-service usage
ALTER TABLE public.asc606_credit_ledger
  ADD COLUMN IF NOT EXISTS service text NOT NULL DEFAULT 'asc606',
  ADD COLUMN IF NOT EXISTS reference_id uuid;

CREATE INDEX IF NOT EXISTS idx_asc606_ledger_service
  ON public.asc606_credit_ledger (account_id, service, created_at DESC);

-- Generic credit consumption RPC usable by any paid service
CREATE OR REPLACE FUNCTION public.consume_platform_credits(
  _account_id uuid,
  _amount numeric,
  _service text,
  _reference_id uuid,
  _user_id uuid,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.asc606_credit_wallets%ROWTYPE;
  v_from_balance numeric := 0;
  v_overage numeric := 0;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  -- Lock + upsert wallet row
  INSERT INTO public.asc606_credit_wallets (account_id)
  VALUES (_account_id)
  ON CONFLICT (account_id) DO NOTHING;

  SELECT * INTO v_wallet
  FROM public.asc606_credit_wallets
  WHERE account_id = _account_id
  FOR UPDATE;

  IF v_wallet.balance_credits >= _amount THEN
    v_from_balance := _amount;
  ELSE
    v_from_balance := GREATEST(v_wallet.balance_credits, 0);
    v_overage := _amount - v_from_balance;
    IF v_overage > 0 AND NOT v_wallet.overage_enabled THEN
      RAISE EXCEPTION 'Insufficient credits and overage disabled';
    END IF;
  END IF;

  UPDATE public.asc606_credit_wallets
  SET balance_credits = balance_credits - v_from_balance,
      lifetime_consumed = lifetime_consumed + _amount,
      pending_overage_credits = pending_overage_credits + v_overage,
      updated_at = now()
  WHERE account_id = _account_id;

  IF v_from_balance > 0 THEN
    INSERT INTO public.asc606_credit_ledger (account_id, delta, kind, service, reference_id, created_by, note)
    VALUES (_account_id, -v_from_balance, 'consume', _service, _reference_id, _user_id, _note);
  END IF;

  IF v_overage > 0 THEN
    INSERT INTO public.asc606_credit_ledger (account_id, delta, kind, service, reference_id, unit_price_cents, created_by, note)
    VALUES (_account_id, -v_overage, 'overage_accrue', _service, _reference_id, 100, _user_id, _note);
  END IF;

  RETURN jsonb_build_object(
    'from_balance', v_from_balance,
    'overage', v_overage
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_platform_credits(uuid, numeric, text, uuid, uuid, text) TO authenticated, service_role;