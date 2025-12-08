-- Create a function to handle user acceptance of team invitations
-- This activates pending account_users entries when invited users sign up/confirm
CREATE OR REPLACE FUNCTION public.handle_team_invitation_acceptance()
RETURNS TRIGGER AS $$
DECLARE
  v_account_id uuid;
  v_role app_role;
BEGIN
  -- Check user metadata for invitation details
  v_account_id := (NEW.raw_user_meta_data->>'invited_to_account')::uuid;
  v_role := COALESCE((NEW.raw_user_meta_data->>'invited_role')::app_role, 'member'::app_role);
  
  -- If user was invited to an account, activate their pending membership
  IF v_account_id IS NOT NULL THEN
    UPDATE public.account_users
    SET 
      status = 'active',
      accepted_at = NOW(),
      role = v_role,
      updated_at = NOW()
    WHERE user_id = NEW.id
      AND account_id = v_account_id
      AND status = 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to run when user confirms email or logs in
DROP TRIGGER IF EXISTS on_user_invitation_acceptance ON auth.users;
CREATE TRIGGER on_user_invitation_acceptance
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_team_invitation_acceptance();

-- Also handle case where user is created with confirmed email (e.g., OAuth)
DROP TRIGGER IF EXISTS on_user_created_with_invitation ON auth.users;
CREATE TRIGGER on_user_created_with_invitation
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL AND NEW.raw_user_meta_data->>'invited_to_account' IS NOT NULL)
  EXECUTE FUNCTION public.handle_team_invitation_acceptance();