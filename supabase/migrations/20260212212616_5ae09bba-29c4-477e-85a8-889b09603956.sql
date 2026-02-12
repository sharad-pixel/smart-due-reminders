
-- Assessment leads table for the Collections Assessment feature
CREATE TABLE public.assessment_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  name TEXT,
  email TEXT,
  company TEXT,
  overdue_count INTEGER NOT NULL,
  overdue_total NUMERIC NOT NULL,
  age_band TEXT NOT NULL,
  loss_pct_band TEXT NOT NULL,
  annual_rate NUMERIC NOT NULL,
  recouply_cost NUMERIC,
  delay_cost NUMERIC,
  loss_risk_cost NUMERIC,
  breakeven_pct NUMERIC,
  roi_multiple NUMERIC,
  risk_tier TEXT,
  gpt_json JSONB,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT
);

-- Enable RLS
ALTER TABLE public.assessment_leads ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (public marketing form)
CREATE POLICY "Anyone can insert assessment leads"
  ON public.assessment_leads
  FOR INSERT
  WITH CHECK (true);

-- Only authenticated admins can read (via service role in edge functions)
CREATE POLICY "Service role can read assessment leads"
  ON public.assessment_leads
  FOR SELECT
  USING (false);

-- Assessment analytics events
CREATE TABLE public.assessment_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL,
  session_id TEXT,
  metadata JSONB
);

ALTER TABLE public.assessment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert assessment events"
  ON public.assessment_events
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "No public reads on assessment events"
  ON public.assessment_events
  FOR SELECT
  USING (false);
