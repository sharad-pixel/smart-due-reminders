ALTER TABLE public.google_sheet_templates 
ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS sync_progress jsonb DEFAULT '{}';
