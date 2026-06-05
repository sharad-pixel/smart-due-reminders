-- Prevent privilege escalation via profile self-update.
-- Adds a BEFORE UPDATE trigger on public.profiles that rejects changes
-- to privileged columns when the caller is not a platform admin or service role.

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_caller_admin boolean := false;
  jwt_role text;
BEGIN
  -- Allow service_role / postgres / superuser writes unconditionally
  BEGIN
    jwt_role := current_setting('request.jwt.claim.role', true);
  EXCEPTION WHEN OTHERS THEN
    jwt_role := NULL;
  END;

  IF jwt_role = 'service_role' OR session_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  -- Determine if the caller is currently an admin (based on the OLD row, not NEW,
  -- to prevent a user from flipping their own is_admin flag in the same update).
  SELECT COALESCE(p.is_admin, false)
    INTO is_caller_admin
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF is_caller_admin THEN
    RETURN NEW;
  END IF;

  -- Non-admin caller: reject changes to privileged columns
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation_trg ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();