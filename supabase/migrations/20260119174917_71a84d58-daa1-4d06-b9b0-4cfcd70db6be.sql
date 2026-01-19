-- Add email verification fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS email_verification_token text,
ADD COLUMN IF NOT EXISTS email_verification_token_expires_at timestamp with time zone;

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email_verification_token 
ON public.profiles(email_verification_token) 
WHERE email_verification_token IS NOT NULL;

-- Update existing users to mark them as verified (they're already using the app)
UPDATE public.profiles 
SET email_verified = true 
WHERE email_verified IS NULL OR email_verified = false;