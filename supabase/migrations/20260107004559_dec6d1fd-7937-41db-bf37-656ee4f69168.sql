-- Add email_format column to branding_settings for user-level preference
ALTER TABLE public.branding_settings 
ADD COLUMN IF NOT EXISTS email_format text DEFAULT 'enhanced' 
CHECK (email_format IN ('simple', 'enhanced'));