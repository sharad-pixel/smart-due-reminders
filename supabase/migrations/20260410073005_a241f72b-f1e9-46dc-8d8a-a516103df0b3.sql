ALTER TABLE public.cached_reports
ADD COLUMN last_manual_refresh_at timestamptz DEFAULT NULL;