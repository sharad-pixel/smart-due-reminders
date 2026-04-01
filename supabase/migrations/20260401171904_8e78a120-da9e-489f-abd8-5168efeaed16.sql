
-- Add template_type enum-like column and sync tracking to google_sheet_templates
ALTER TABLE public.google_sheet_templates 
  ADD COLUMN IF NOT EXISTS sync_direction text DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS last_push_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_pull_at timestamptz,
  ADD COLUMN IF NOT EXISTS folder_path text;

-- Drop the debtor_id constraint - master sheets contain ALL data, not per-debtor
ALTER TABLE public.google_sheet_templates 
  ALTER COLUMN debtor_id DROP NOT NULL;

-- Update template_type to support new types
-- existing values: 'invoice_submission' -> we'll add 'accounts', 'invoices', 'payments'
