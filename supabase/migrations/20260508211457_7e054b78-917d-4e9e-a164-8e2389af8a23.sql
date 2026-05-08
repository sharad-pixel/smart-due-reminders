ALTER TABLE public.clm_templates
  ADD COLUMN IF NOT EXISTS assessment JSONB,
  ADD COLUMN IF NOT EXISTS assessment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS assessment_error TEXT,
  ADD COLUMN IF NOT EXISTS assessed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assessment_model TEXT;