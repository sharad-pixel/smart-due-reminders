-- Add clearer columns for invite process
ALTER TABLE public.early_access_whitelist 
ADD COLUMN IF NOT EXISTS inviter_name TEXT,
ADD COLUMN IF NOT EXISTS inviter_email TEXT;

-- Add column comments for clarity in the UI
COMMENT ON COLUMN public.early_access_whitelist.email IS 'Email address to invite (recipient)';
COMMENT ON COLUMN public.early_access_whitelist.inviter_name IS 'Name of person sending the invite';
COMMENT ON COLUMN public.early_access_whitelist.inviter_email IS 'Email of person sending the invite';
COMMENT ON COLUMN public.early_access_whitelist.notes IS 'Optional note about this invite';
COMMENT ON COLUMN public.early_access_whitelist.invited_at IS 'When the invite was added';
COMMENT ON COLUMN public.early_access_whitelist.used_at IS 'When the invitee signed up';