-- Add column to enable AI persona names as email signatures
ALTER TABLE public.branding_settings 
ADD COLUMN IF NOT EXISTS use_persona_signatures boolean DEFAULT false;

-- Add comment explaining the field
COMMENT ON COLUMN public.branding_settings.use_persona_signatures IS 'When enabled, AI agent persona names are used as professional signatures in outreach emails';