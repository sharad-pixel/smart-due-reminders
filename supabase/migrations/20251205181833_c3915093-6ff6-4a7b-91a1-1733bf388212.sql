-- Add invitee_name column
ALTER TABLE public.early_access_whitelist 
ADD COLUMN IF NOT EXISTS invitee_name TEXT;

-- Update column comments to clearly label invitee vs inviter
COMMENT ON COLUMN public.early_access_whitelist.email IS 'Invitee Email - Email address of person being invited';
COMMENT ON COLUMN public.early_access_whitelist.invitee_name IS 'Invitee Name - Name of person being invited';
COMMENT ON COLUMN public.early_access_whitelist.inviter_name IS 'Inviter Name - Name of person sending the invite';
COMMENT ON COLUMN public.early_access_whitelist.inviter_email IS 'Inviter Email - Email of person sending the invite';
COMMENT ON COLUMN public.early_access_whitelist.notes IS 'Notes - Optional note about this invite';
COMMENT ON COLUMN public.early_access_whitelist.invited_at IS 'Invited At - When the invite was added';
COMMENT ON COLUMN public.early_access_whitelist.used_at IS 'Used At - When the invitee signed up';