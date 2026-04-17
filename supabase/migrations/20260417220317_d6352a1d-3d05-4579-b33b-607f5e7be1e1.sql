-- ============================================================
-- P4: Privilege escalation lockdown on profiles
-- ============================================================

-- Trigger: prevent users from self-elevating privileged fields.
-- Allowed callers: service_role (edge functions) and existing admins.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_service_role boolean := false;
  v_caller_is_admin boolean := false;
BEGIN
  -- Detect service_role context (edge functions using SUPABASE_SERVICE_ROLE_KEY)
  BEGIN
    v_is_service_role := current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role';
  EXCEPTION WHEN OTHERS THEN
    v_is_service_role := false;
  END;

  -- Service role bypasses all guards
  IF v_is_service_role THEN
    RETURN NEW;
  END IF;

  -- Detect if the caller (auth.uid()) is an existing admin (by reading OLD row, not NEW)
  IF auth.uid() IS NOT NULL THEN
    SELECT COALESCE(p.is_admin, false) INTO v_caller_is_admin
    FROM public.profiles p
    WHERE p.id = auth.uid();
  END IF;

  -- Existing admins may modify privileged fields (e.g., admin promoting another user via the UI)
  IF v_caller_is_admin THEN
    RETURN NEW;
  END IF;

  -- For everyone else (regular authenticated users updating their own row),
  -- force privileged fields to retain their OLD values.
  NEW.is_admin                := OLD.is_admin;
  NEW.is_suspended            := OLD.is_suspended;
  NEW.suspended_at            := OLD.suspended_at;
  NEW.suspended_reason        := OLD.suspended_reason;
  NEW.plan_type               := OLD.plan_type;
  NEW.plan_id                 := OLD.plan_id;
  NEW.subscription_status     := OLD.subscription_status;
  NEW.stripe_customer_id      := OLD.stripe_customer_id;
  NEW.stripe_subscription_id  := OLD.stripe_subscription_id;
  NEW.invoice_limit           := OLD.invoice_limit;
  NEW.overage_rate            := OLD.overage_rate;
  NEW.trial_ends_at           := OLD.trial_ends_at;
  NEW.cancel_at_period_end    := OLD.cancel_at_period_end;
  NEW.current_period_end      := OLD.current_period_end;
  NEW.billing_interval        := OLD.billing_interval;
  NEW.recouply_customer_id    := OLD.recouply_customer_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation_trg ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- ============================================================
-- P4: Payment plan installments — drop the public_token leak
-- ============================================================

-- Drop the overly permissive policy that exposed installments to all
-- authenticated users whenever a payment plan had a public_token (default behavior).
DROP POLICY IF EXISTS "Authenticated can view installments for public payment plans"
  ON public.payment_plan_installments;

-- Ensure an owner/team-scoped SELECT policy exists. Public/debtor access
-- continues to work through the SECURITY DEFINER function get_payment_plan_by_token.
DROP POLICY IF EXISTS "Account members can view installments"
  ON public.payment_plan_installments;

CREATE POLICY "Account members can view installments"
ON public.payment_plan_installments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.payment_plans pp
    WHERE pp.id = payment_plan_installments.payment_plan_id
      AND public.can_access_account_data(auth.uid(), pp.user_id)
  )
);