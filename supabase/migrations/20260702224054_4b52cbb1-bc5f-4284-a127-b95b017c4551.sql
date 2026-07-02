
CREATE TABLE public.integration_error_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  integration_source TEXT NOT NULL,
  error_type TEXT NOT NULL,
  error_fingerprint TEXT NOT NULL,
  sample_message TEXT,
  reason TEXT,
  ai_resolution JSONB,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, integration_source, error_fingerprint)
);
CREATE INDEX idx_ied_user ON public.integration_error_dismissals(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_error_dismissals TO authenticated;
GRANT ALL ON public.integration_error_dismissals TO service_role;
ALTER TABLE public.integration_error_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own error dismissals" ON public.integration_error_dismissals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
