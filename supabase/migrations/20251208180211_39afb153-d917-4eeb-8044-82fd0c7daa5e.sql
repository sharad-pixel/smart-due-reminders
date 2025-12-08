-- Fix get_user_organization_id to prioritize team membership (child account) over personal org ownership
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
    -- Check if organization_id is set directly
    SELECT organization_id INTO v_org_id
    FROM account_users
    WHERE user_id = p_user_id 
      AND account_id = v_account_id 
      AND status = 'active'
    LIMIT 1;
    
    IF v_org_id IS NOT NULL THEN 
      RETURN v_org_id; 
    END IF;
    
    -- Fall back to getting org via parent account_id
    SELECT id INTO v_org_id FROM organizations WHERE owner_user_id = v_account_id;
    IF v_org_id IS NOT NULL THEN 
      RETURN v_org_id; 
    END IF;
  END IF;
  
  -- If not a team member, check if user owns an organization
  SELECT id INTO v_org_id FROM organizations WHERE owner_user_id = p_user_id;
  
  RETURN v_org_id;
END;
$function$;