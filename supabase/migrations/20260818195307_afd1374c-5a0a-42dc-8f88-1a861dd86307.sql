-- 1) Harden profiles privileged-column protection
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_caller_admin boolean := false;
  jwt_role text;
BEGIN
  BEGIN
    jwt_role := current_setting('request.jwt.claim.role', true);
    IF jwt_role IS NULL THEN
      jwt_role := (current_setting('request.jwt.claims', true)::json ->> 'role');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    jwt_role := NULL;
  END;

  IF jwt_role = 'service_role' OR session_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.is_admin, false) INTO is_caller_admin
  FROM public.profiles p WHERE p.id = auth.uid();

  IF is_caller_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Not authorized to modify id';
  END IF;
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    RAISE EXCEPTION 'Not authorized to modify is_admin';
  END IF;
  IF NEW.is_support_user IS DISTINCT FROM OLD.is_support_user THEN
    RAISE EXCEPTION 'Not authorized to modify is_support_user';
  END IF;
  IF NEW.is_suspended IS DISTINCT FROM OLD.is_suspended THEN
    RAISE EXCEPTION 'Not authorized to modify is_suspended';
  END IF;
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    RAISE EXCEPTION 'Not authorized to modify subscription_status';
  END IF;
  IF NEW.plan_type IS DISTINCT FROM OLD.plan_type THEN
    RAISE EXCEPTION 'Not authorized to modify plan_type';
  END IF;
  IF NEW.invoice_limit IS DISTINCT FROM OLD.invoice_limit THEN
    RAISE EXCEPTION 'Not authorized to modify invoice_limit';
  END IF;
  IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id THEN
    RAISE EXCEPTION 'Not authorized to modify stripe_customer_id';
  END IF;
  IF to_jsonb(NEW) ? 'admin_override' AND (to_jsonb(NEW) -> 'admin_override') IS DISTINCT FROM (to_jsonb(OLD) -> 'admin_override') THEN
    RAISE EXCEPTION 'Not authorized to modify admin_override';
  END IF;
  IF to_jsonb(NEW) ? 'credit_allotment' AND (to_jsonb(NEW) -> 'credit_allotment') IS DISTINCT FROM (to_jsonb(OLD) -> 'credit_allotment') THEN
    RAISE EXCEPTION 'Not authorized to modify credit_allotment';
  END IF;
  IF to_jsonb(NEW) ? 'included_contracts' AND (to_jsonb(NEW) -> 'included_contracts') IS DISTINCT FROM (to_jsonb(OLD) -> 'included_contracts') THEN
    RAISE EXCEPTION 'Not authorized to modify included_contracts';
  END IF;
  IF to_jsonb(NEW) ? 'stripe_subscription_id' AND (to_jsonb(NEW) -> 'stripe_subscription_id') IS DISTINCT FROM (to_jsonb(OLD) -> 'stripe_subscription_id') THEN
    RAISE EXCEPTION 'Not authorized to modify stripe_subscription_id';
  END IF;
  IF to_jsonb(NEW) ? 'trial_ends_at' AND (to_jsonb(NEW) -> 'trial_ends_at') IS DISTINCT FROM (to_jsonb(OLD) -> 'trial_ends_at') THEN
    RAISE EXCEPTION 'Not authorized to modify trial_ends_at';
  END IF;
  IF to_jsonb(NEW) ? 'trial_used_at' AND (to_jsonb(NEW) -> 'trial_used_at') IS DISTINCT FROM (to_jsonb(OLD) -> 'trial_used_at') THEN
    RAISE EXCEPTION 'Not authorized to modify trial_used_at';
  END IF;
  IF to_jsonb(NEW) ? 'current_period_end' AND (to_jsonb(NEW) -> 'current_period_end') IS DISTINCT FROM (to_jsonb(OLD) -> 'current_period_end') THEN
    RAISE EXCEPTION 'Not authorized to modify current_period_end';
  END IF;
  IF to_jsonb(NEW) ? 'plan_id' AND (to_jsonb(NEW) -> 'plan_id') IS DISTINCT FROM (to_jsonb(OLD) -> 'plan_id') THEN
    RAISE EXCEPTION 'Not authorized to modify plan_id';
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Add WITH CHECK mirroring USING on all UPDATE policies that lack one
DO $do$
DECLARE
  r record;
  expr text;
BEGIN
  FOR r IN
    SELECT p.polname, c.relname, pg_get_expr(p.polqual, p.polrelid) AS using_expr
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND p.polcmd = 'w'
      AND p.polwithcheck IS NULL
      AND pg_get_expr(p.polqual, p.polrelid) IS NOT NULL
  LOOP
    expr := r.using_expr;
    -- skip state-transition guards that must only apply to the existing row
    IF expr ILIKE '%is_locked%' OR expr ILIKE '%status%' THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)', r.polname, r.relname, expr);
  END LOOP;
END
$do$;