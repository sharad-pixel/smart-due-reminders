-- Add sender identity columns to branding_settings
ALTER TABLE public.branding_settings
ADD COLUMN IF NOT EXISTS sending_mode text DEFAULT 'recouply_default';

ALTER TABLE public.branding_settings
ADD COLUMN IF NOT EXISTS from_email_verified boolean DEFAULT false;

ALTER TABLE public.branding_settings
ADD COLUMN IF NOT EXISTS from_email_verification_status text DEFAULT 'unverified';

ALTER TABLE public.branding_settings
ADD COLUMN IF NOT EXISTS verified_from_email text;

ALTER TABLE public.branding_settings
ADD COLUMN IF NOT EXISTS last_test_email_sent_at timestamptz;

ALTER TABLE public.branding_settings
ADD COLUMN IF NOT EXISTS email_wrapper_enabled boolean DEFAULT true;

-- Add check constraints
ALTER TABLE public.branding_settings
DROP CONSTRAINT IF EXISTS branding_settings_sending_mode_check;

ALTER TABLE public.branding_settings
ADD CONSTRAINT branding_settings_sending_mode_check 
CHECK (sending_mode IS NULL OR sending_mode IN ('recouply_default','customer_domain','recouply_subdomain'));

ALTER TABLE public.branding_settings
DROP CONSTRAINT IF EXISTS branding_settings_verification_status_check;

ALTER TABLE public.branding_settings
ADD CONSTRAINT branding_settings_verification_status_check 
CHECK (from_email_verification_status IS NULL OR from_email_verification_status IN ('unverified','pending','verified','failed'));

-- Add unique constraint on user_id if not exists
CREATE UNIQUE INDEX IF NOT EXISTS branding_settings_user_unique
ON public.branding_settings(user_id);

-- Add applied_brand_snapshot to ai_drafts for auditing
ALTER TABLE public.ai_drafts
ADD COLUMN IF NOT EXISTS applied_brand_snapshot jsonb;