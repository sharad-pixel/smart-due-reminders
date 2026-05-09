
ALTER TABLE public.clm_template_instances
  ADD COLUMN IF NOT EXISTS gdoc_document_id TEXT,
  ADD COLUMN IF NOT EXISTS gdoc_url TEXT,
  ADD COLUMN IF NOT EXISTS gdoc_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gdoc_synced_by UUID;
