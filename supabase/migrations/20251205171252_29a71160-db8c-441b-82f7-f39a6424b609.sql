-- Add welcome_email_sent_at to profiles table to track welcome email delivery
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient querying of users who need welcome emails
CREATE INDEX IF NOT EXISTS idx_profiles_welcome_email ON public.profiles (welcome_email_sent_at) WHERE welcome_email_sent_at IS NULL;