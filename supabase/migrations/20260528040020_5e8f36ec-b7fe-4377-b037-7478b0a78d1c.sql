
-- 1. Revoke direct client read on crm_connections (tokens). Reads go through service-role edge functions or the crm_connections_safe view.
DROP POLICY IF EXISTS "Users can view their own CRM connections" ON public.crm_connections;

-- 2. Prevent privilege escalation: block non-admins from changing is_admin on profiles.
CREATE OR REPLACE FUNCTION public.prevent_profile_is_admin_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    IF NOT public.is_recouply_admin(auth.uid()) THEN
      NEW.is_admin := OLD.is_admin;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_is_admin_self_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_is_admin_self_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_is_admin_self_escalation();
