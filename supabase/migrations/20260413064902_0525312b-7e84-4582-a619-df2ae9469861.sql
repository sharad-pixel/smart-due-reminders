ALTER TABLE public.branding_settings 
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS business_description TEXT;