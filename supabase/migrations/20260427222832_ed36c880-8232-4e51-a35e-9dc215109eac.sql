ALTER TABLE public.ingestion_scanned_files
  ADD COLUMN IF NOT EXISTS page_count INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.ingestion_usage_charges
  ADD COLUMN IF NOT EXISTS page_count INTEGER NOT NULL DEFAULT 1;