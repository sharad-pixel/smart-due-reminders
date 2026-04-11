ALTER TABLE public.branding_settings
ADD COLUMN IF NOT EXISTS include_portal_link_in_outreach boolean NOT NULL DEFAULT true;