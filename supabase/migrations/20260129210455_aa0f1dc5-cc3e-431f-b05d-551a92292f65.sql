-- Add auto_approve_drafts column to branding_settings
ALTER TABLE public.branding_settings
ADD COLUMN IF NOT EXISTS auto_approve_drafts boolean NOT NULL DEFAULT false;

-- Add a helpful comment
COMMENT ON COLUMN public.branding_settings.auto_approve_drafts IS 'When enabled, newly generated outreach drafts are automatically approved and scheduled for sending';