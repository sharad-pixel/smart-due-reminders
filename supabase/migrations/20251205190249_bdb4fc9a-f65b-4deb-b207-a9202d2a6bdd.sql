-- Function to sync auth.users to early_access_whitelist
CREATE OR REPLACE FUNCTION public.sync_auth_user_to_whitelist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into whitelist if email doesn't already exist
  INSERT INTO public.early_access_whitelist (
    email,
    invitee_name,
    inviter_name,
    notes,
    invited_at
  )
  VALUES (
    LOWER(NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', ''),
    'Cloud UI',
    'Invited via Lovable Cloud Users section',
    NOW()
  )
  ON CONFLICT (email) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users table
CREATE TRIGGER on_auth_user_created_whitelist
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_auth_user_to_whitelist();