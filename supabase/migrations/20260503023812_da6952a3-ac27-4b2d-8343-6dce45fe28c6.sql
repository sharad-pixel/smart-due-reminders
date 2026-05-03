CREATE OR REPLACE FUNCTION public.is_active_support_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.support_users su
    WHERE su.auth_user_id = p_user_id
      AND su.is_active = true
  )
  AND COALESCE((SELECT p.is_support_user FROM public.profiles p WHERE p.id = p_user_id), false) = true;
$$;

CREATE OR REPLACE FUNCTION public.has_active_support_access(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.support_access_grants
    WHERE account_id = p_account_id
      AND revoked_at IS NULL
      AND expires_at > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_active_support_write_access(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.support_access_grants
    WHERE account_id = p_account_id
      AND scope = 'write'
      AND revoked_at IS NULL
      AND expires_at > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_support_with_access(p_user_id uuid, p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_active_support_user(p_user_id)
     AND public.has_active_support_access(p_account_id);
$$;

CREATE OR REPLACE FUNCTION public.is_support_with_write_access(p_user_id uuid, p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_active_support_user(p_user_id)
     AND public.has_active_support_write_access(p_account_id);
$$;

CREATE OR REPLACE FUNCTION public.can_access_account_data(p_user_id uuid, p_data_owner_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_user_id = p_data_owner_id THEN
    RETURN true;
  END IF;

  IF public.is_support_with_access(p_user_id, p_data_owner_id) THEN
    RETURN true;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM public.account_users
    WHERE user_id = p_user_id
      AND account_id = p_data_owner_id
      AND status = 'active'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_write_as_account(p_user_id uuid, p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p_user_id = p_account_id
    OR public.is_support_with_write_access(p_user_id, p_account_id)
    OR EXISTS (
      SELECT 1
      FROM public.account_users
      WHERE user_id = p_user_id
        AND account_id = p_account_id
        AND status = 'active'
        AND role IN ('owner', 'admin', 'member')
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_active_support_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_support_write_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_support_with_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_support_with_write_access(uuid, uuid) TO authenticated;