-- Update get_user_organization_id to look up parent org via account_id if organization_id is null
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
  -- First check if user owns an organization
  SELECT id INTO v_org_id FROM organizations WHERE owner_user_id = p_user_id;
  IF v_org_id IS NOT NULL THEN RETURN v_org_id; END IF;
  
  -- Check if organization_id is directly set on account_users
  SELECT organization_id INTO v_org_id
  FROM account_users
  WHERE user_id = p_user_id AND status = 'active' AND organization_id IS NOT NULL
  ORDER BY accepted_at DESC LIMIT 1;
  
  IF v_org_id IS NOT NULL THEN RETURN v_org_id; END IF;
  
  -- Fall back: get org via account_id (parent owner)
  SELECT account_id INTO v_account_id
  FROM account_users
  WHERE user_id = p_user_id AND status = 'active' AND is_owner = false
  ORDER BY accepted_at DESC LIMIT 1;
  
  IF v_account_id IS NOT NULL THEN
    SELECT id INTO v_org_id FROM organizations WHERE owner_user_id = v_account_id;
  END IF;
  
  RETURN v_org_id;
END;
$function$;

-- Also update existing account_users to set organization_id from parent
UPDATE account_users au
SET organization_id = (
  SELECT o.id FROM organizations o WHERE o.owner_user_id = au.account_id
)
WHERE au.organization_id IS NULL
  AND au.is_owner = false
  AND au.account_id IS NOT NULL;