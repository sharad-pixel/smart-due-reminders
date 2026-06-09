
CREATE TABLE public.intelligence_run_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  debtor_id UUID NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  billing_month TEXT NOT NULL, -- YYYY-MM
  run_count INTEGER NOT NULL DEFAULT 0,
  billable_runs INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, debtor_id, billing_month)
);

GRANT SELECT ON public.intelligence_run_usage TO authenticated;
GRANT ALL ON public.intelligence_run_usage TO service_role;

ALTER TABLE public.intelligence_run_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own intelligence run usage"
  ON public.intelligence_run_usage
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_intel_run_usage_user_month
  ON public.intelligence_run_usage(user_id, billing_month);
