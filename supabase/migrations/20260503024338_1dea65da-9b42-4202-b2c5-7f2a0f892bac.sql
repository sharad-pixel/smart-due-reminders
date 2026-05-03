CREATE OR REPLACE FUNCTION public.is_support_with_access(p_user_id uuid, p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (public.is_recouply_admin(p_user_id) OR public.is_active_support_user(p_user_id))
     AND public.has_active_support_access(p_account_id);
$$;

CREATE OR REPLACE FUNCTION public.is_support_with_write_access(p_user_id uuid, p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (public.is_recouply_admin(p_user_id) OR public.is_active_support_user(p_user_id))
     AND public.has_active_support_write_access(p_account_id);
$$;