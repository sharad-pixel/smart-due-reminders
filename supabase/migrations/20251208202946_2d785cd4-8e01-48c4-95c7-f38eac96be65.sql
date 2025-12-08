-- Add email preferences column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS daily_digest_email_enabled BOOLEAN DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.daily_digest_email_enabled IS 'Whether user wants to receive daily health digest emails';