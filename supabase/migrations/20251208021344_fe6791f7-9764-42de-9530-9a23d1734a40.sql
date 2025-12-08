
-- Create owner entry for all existing profile users who don't have one
-- This ensures proper account hierarchy
INSERT INTO account_users (account_id, user_id, role, status, invited_at, accepted_at)
SELECT 
  p.id as account_id,
  p.id as user_id,
  'owner'::app_role as role,
  'active' as status,
  p.created_at as invited_at,
  p.created_at as accepted_at
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM account_users au 
  WHERE au.account_id = p.id AND au.user_id = p.id AND au.role = 'owner'
)
ON CONFLICT DO NOTHING;

-- Create a trigger function to automatically create owner entry for new users
CREATE OR REPLACE FUNCTION public.create_owner_account_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create owner entry in account_users for new profile
  INSERT INTO account_users (account_id, user_id, role, status, invited_at, accepted_at)
  VALUES (NEW.id, NEW.id, 'owner', 'active', NOW(), NOW())
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_profile_created_create_owner ON public.profiles;

-- Create trigger on profiles table
CREATE TRIGGER on_profile_created_create_owner
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_owner_account_entry();
