
CREATE OR REPLACE FUNCTION public.get_user_organization_id(p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_account_id uuid;
BEGIN
  -- FIRST check if user is a team member (child) of another account - this takes priority
  SELECT account_id INTO v_account_id
  FROM account_users
  WHERE user_id = p_user_id 
    AND status = 'active' 
    AND is_owner = false
  ORDER BY accepted_at DESC LIMIT 1;
  
  -- If they are a team member, get the parent's organization
  IF v_account_id IS NOT NULL THEN
    SELECT organization_id INTO v_org_id
    FROM account_users
    WHERE user_id = p_user_id 
      AND account_id = v_account_id 
      AND status = 'active'
    LIMIT 1;
    
    IF v_org_id IS NOT NULL THEN 
      RETURN v_org_id; 
    END IF;
    
    SELECT id INTO v_org_id FROM organizations WHERE owner_user_id = v_account_id;
    IF v_org_id IS NOT NULL THEN 
      RETURN v_org_id; 
    END IF;
  END IF;
  
  -- Check if user is owner of a DIFFERENT account (transferred ownership)
  SELECT account_id INTO v_account_id
  FROM account_users
  WHERE user_id = p_user_id
    AND account_id != p_user_id
    AND is_owner = true
    AND status = 'active'
  LIMIT 1;

  IF v_account_id IS NOT NULL THEN
    SELECT id INTO v_org_id FROM organizations WHERE owner_user_id = p_user_id;
    IF v_org_id IS NOT NULL THEN
      RETURN v_org_id;
    END IF;
    -- Fallback: org might still reference old account_id
    SELECT id INTO v_org_id FROM organizations WHERE owner_user_id = v_account_id;
    IF v_org_id IS NOT NULL THEN
      RETURN v_org_id;
    END IF;
  END IF;

  -- If not a team member, check if user owns an organization directly
  SELECT id INTO v_org_id FROM organizations WHERE owner_user_id = p_user_id;
  
  RETURN v_org_id;
END;
$function$;
