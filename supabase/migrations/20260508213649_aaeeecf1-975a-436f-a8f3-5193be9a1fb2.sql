
ALTER TABLE public.clm_templates
ADD COLUMN IF NOT EXISTS assessment_ignored_risks jsonb NOT NULL DEFAULT '[]'::jsonb;
