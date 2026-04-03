
CREATE TABLE public.outreach_batch_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  drafts_generated INT DEFAULT 0,
  drafts_sent INT DEFAULT 0,
  drafts_cancelled INT DEFAULT 0,
  drafts_failed INT DEFAULT 0,
  invoices_processed INT DEFAULT 0,
  workflows_assigned INT DEFAULT 0,
  workflows_upgraded INT DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.outreach_batch_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own batch runs"
  ON public.outreach_batch_runs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert batch runs"
  ON public.outreach_batch_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_outreach_batch_runs_user_id ON public.outreach_batch_runs (user_id, started_at DESC);
