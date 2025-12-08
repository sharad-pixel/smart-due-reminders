-- Add invite token columns to account_users for secure invite flow
ALTER TABLE public.account_users 
ADD COLUMN IF NOT EXISTS invite_token TEXT,
ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP WITH TIME ZONE;

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_account_users_invite_token ON public.account_users(invite_token) WHERE invite_token IS NOT NULL;

-- Create a function to generate secure random tokens
CREATE OR REPLACE FUNCTION generate_invite_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$;

-- Create a function to accept invite by token (called from edge function)
CREATE OR REPLACE FUNCTION accept_team_invite(
  p_token TEXT,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_result JSON;
BEGIN
  -- Find valid pending invite with matching token
  SELECT * INTO v_invite
  FROM public.account_users
  WHERE invite_token = p_token
    AND status = 'pending'
    AND invite_expires_at > now();
    
  IF v_invite IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired invite token');
  END IF;
  
  -- Update the invite to active
  UPDATE public.account_users
  SET 
    user_id = p_user_id,
    status = 'active',
    accepted_at = now(),
    invite_token = NULL,
    invite_expires_at = NULL,
    updated_at = now()
  WHERE id = v_invite.id;
  
  RETURN json_build_object(
    'success', true, 
    'account_id', v_invite.account_id,
    'role', v_invite.role,
    'email', v_invite.email
  );
END;
$$;

-- Create function to validate invite token (for UI display)
CREATE OR REPLACE FUNCTION validate_invite_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_account RECORD;
BEGIN
  -- Find invite by token
  SELECT au.*, p.name as account_owner_name, p.email as account_owner_email
  INTO v_invite
  FROM public.account_users au
  LEFT JOIN public.profiles p ON p.id = au.account_id
  WHERE au.invite_token = p_token
    AND au.status = 'pending';
    
  IF v_invite IS NULL THEN
    RETURN json_build_object('valid', false, 'error', 'Invite not found');
  END IF;
  
  IF v_invite.invite_expires_at < now() THEN
    RETURN json_build_object('valid', false, 'error', 'Invite has expired');
  END IF;
  
  RETURN json_build_object(
    'valid', true,
    'email', v_invite.email,
    'role', v_invite.role,
    'account_owner_name', v_invite.account_owner_name,
    'expires_at', v_invite.invite_expires_at
  );
END;
$$;