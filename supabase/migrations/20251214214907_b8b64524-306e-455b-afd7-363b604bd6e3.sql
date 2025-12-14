-- Fix the trigger to properly set is_owner = true for owner entries
CREATE OR REPLACE FUNCTION public.create_owner_account_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Create owner entry in account_users for new profile
  INSERT INTO account_users (account_id, user_id, role, status, invited_at, accepted_at, is_owner)
  VALUES (NEW.id, NEW.id, 'owner', 'active', NOW(), NOW(), true)
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$function$;