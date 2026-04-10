
CREATE TABLE public.cached_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  report_type text NOT NULL,
  report_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, report_type)
);

ALTER TABLE public.cached_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cached reports"
ON public.cached_reports FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cached reports"
ON public.cached_reports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cached reports"
ON public.cached_reports FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cached reports"
ON public.cached_reports FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_cached_reports_user_type ON public.cached_reports (user_id, report_type);

CREATE TRIGGER update_cached_reports_updated_at
BEFORE UPDATE ON public.cached_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
