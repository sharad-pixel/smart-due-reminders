
CREATE OR REPLACE FUNCTION public.get_effective_account_id(p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_account_id uuid;
BEGIN
  -- Check if user is a non-owner member of ANOTHER account (team membership)
  SELECT account_id INTO v_account_id
  FROM account_users
  WHERE user_id = p_user_id
    AND account_id != p_user_id
    AND is_owner = false
    AND status = 'active'
  ORDER BY accepted_at DESC
  LIMIT 1;

  IF v_account_id IS NOT NULL THEN
    RETURN v_account_id;
  END IF;

  -- Check if user is the owner of a DIFFERENT account (transferred ownership scenario)
  SELECT account_id INTO v_account_id
  FROM account_users
  WHERE user_id = p_user_id
    AND account_id != p_user_id
    AND is_owner = true
    AND status = 'active'
  ORDER BY accepted_at DESC
  LIMIT 1;

  IF v_account_id IS NOT NULL THEN
    RETURN v_account_id;
  END IF;

  -- Default: user is their own account
  RETURN p_user_id;
END;
$function$;
