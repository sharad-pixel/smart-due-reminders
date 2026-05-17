
DROP FUNCTION IF EXISTS public.consume_platform_credits(uuid, numeric, text, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.consume_platform_credits(uuid, numeric, text, uuid, uuid);
DROP FUNCTION IF EXISTS public.consume_platform_credits(uuid, numeric, text, uuid);

ALTER TABLE public.ocr_usage_events
  ADD COLUMN IF NOT EXISTS ledger_id uuid REFERENCES public.asc606_credit_ledger(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ocr_usage_events_ledger ON public.ocr_usage_events(ledger_id);

CREATE FUNCTION public.consume_platform_credits(
  _account_id uuid,
  _amount numeric,
  _service text,
  _user_id uuid DEFAULT NULL,
  _reference_id uuid DEFAULT NULL,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  w public.asc606_credit_wallets%ROWTYPE;
  v_ledger_id uuid;
  v_method text;
  v_unit_price integer;
  v_kind text;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

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
    v_method := 'credits';
    v_unit_price := 80;
    v_kind := 'consume';
  ELSIF w.overage_enabled THEN
    UPDATE public.asc606_credit_wallets
       SET pending_overage_credits = pending_overage_credits + _amount,
           lifetime_consumed = lifetime_consumed + _amount
     WHERE account_id = _account_id;
    v_method := 'overage';
    v_unit_price := 100;
    v_kind := 'overage_accrue';
  ELSE
    RAISE EXCEPTION 'Insufficient credits and overage disabled' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.asc606_credit_ledger(
    account_id, delta, kind, service, reference_id, unit_price_cents, created_by, note
  )
  VALUES (
    _account_id, -_amount, v_kind, _service, _reference_id, v_unit_price, _user_id,
    COALESCE(_note, _service || ' usage')
  )
  RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'method', v_method,
    'ledger_id', v_ledger_id,
    'new_balance', CASE WHEN v_method = 'credits' THEN w.balance_credits - _amount ELSE w.balance_credits END,
    'overage_added', CASE WHEN v_method = 'overage' THEN _amount ELSE 0 END
  );
END $function$;

CREATE OR REPLACE FUNCTION public.consume_asc606_credits(
  _account_id uuid,
  _amount numeric,
  _contract_id uuid,
  _assessment_id uuid,
  _user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  res jsonb;
BEGIN
  res := public.consume_platform_credits(
    _account_id, _amount, 'asc606', _user_id, _contract_id, 'ASC 606 assessment'
  );
  IF res ? 'ledger_id' AND _assessment_id IS NOT NULL THEN
    UPDATE public.asc606_credit_ledger
       SET assessment_id = _assessment_id,
           contract_id = COALESCE(contract_id, _contract_id)
     WHERE id = (res->>'ledger_id')::uuid;
  END IF;
  RETURN res;
END $function$;

DO $$
DECLARE
  ev RECORD;
  v_ledger_id uuid;
BEGIN
  FOR ev IN
    SELECT id, account_id, user_id, page_count, file_name, contract_id, invoice_id
      FROM public.ocr_usage_events
     WHERE COALESCE(stripe_reported, false) = false
       AND ledger_id IS NULL
       AND account_id IS NOT NULL
       AND page_count > 0
  LOOP
    INSERT INTO public.asc606_credit_wallets(account_id) VALUES (ev.account_id)
      ON CONFLICT (account_id) DO NOTHING;

    UPDATE public.asc606_credit_wallets
       SET pending_overage_credits = pending_overage_credits + ev.page_count,
           lifetime_consumed = lifetime_consumed + ev.page_count
     WHERE account_id = ev.account_id;

    INSERT INTO public.asc606_credit_ledger(
      account_id, delta, kind, service, reference_id, unit_price_cents, created_by, note
    )
    VALUES (
      ev.account_id, -ev.page_count, 'overage_accrue', 'smart_ingestion',
      COALESCE(ev.invoice_id, ev.contract_id),
      100, ev.user_id,
      'Smart Ingestion backfill — ' || COALESCE(ev.file_name, 'document')
    )
    RETURNING id INTO v_ledger_id;

    UPDATE public.ocr_usage_events
       SET ledger_id = v_ledger_id,
           stripe_reported = true
     WHERE id = ev.id;
  END LOOP;
END $$;
