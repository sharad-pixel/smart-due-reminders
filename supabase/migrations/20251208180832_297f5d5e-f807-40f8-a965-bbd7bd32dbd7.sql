-- Fix get_effective_account_id to exclude self-referencing entries
-- (where account_id = user_id, which aren't real team memberships)
CREATE OR REPLACE FUNCTION public.get_effective_account_id(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_account_id uuid;
BEGIN
  -- Check if user is a non-owner member of ANOTHER account (not their own)
  SELECT account_id INTO v_account_id
  FROM account_users
  WHERE user_id = p_user_id
    AND account_id != p_user_id  -- Must be a different account (real team membership)
    AND is_owner = false
    AND status = 'active'
  ORDER BY accepted_at DESC
  LIMIT 1;
  
  -- If they are part of another team, return that account owner's ID
  IF v_account_id IS NOT NULL THEN
    RETURN v_account_id;
  END IF;
  
  -- Otherwise return their own ID (they are an owner or independent user)
  RETURN p_user_id;
END;
$function$;