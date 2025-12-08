-- Add enterprise team management columns to account_users
-- Working with existing pattern where account_id = owner's user_id

-- Add new columns for enterprise features
ALTER TABLE public.account_users 
  ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_account_users_account_id ON public.account_users(account_id);
CREATE INDEX IF NOT EXISTS idx_account_users_status ON public.account_users(status);
CREATE INDEX IF NOT EXISTS idx_account_users_is_owner ON public.account_users(is_owner);

-- Set is_owner flag for all owner role entries
UPDATE account_users SET is_owner = TRUE WHERE role = 'owner';

-- Update email field from profiles for existing users
UPDATE account_users au
SET email = p.email
FROM profiles p
WHERE au.user_id = p.id AND au.email IS NULL;

-- Function to get billable seat count for an account
CREATE OR REPLACE FUNCTION public.get_billable_seat_count(p_account_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM account_users
  WHERE account_id = p_account_id
    AND is_owner = FALSE
    AND status = 'active'
$$;