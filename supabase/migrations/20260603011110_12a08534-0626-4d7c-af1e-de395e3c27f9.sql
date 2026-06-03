ALTER TABLE public.google_sheet_templates
  ADD COLUMN IF NOT EXISTS column_config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.google_sheet_templates.column_config IS
  'Per-template column/object selection. Shape: { "<sheetKey>": { "columns": ["headerKey",...] }, "objects": ["master","risks",...] }';