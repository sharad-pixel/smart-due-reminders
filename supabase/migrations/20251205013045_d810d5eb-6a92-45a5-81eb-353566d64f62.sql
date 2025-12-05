-- Create daily_digests table for storing computed daily health summaries
CREATE TABLE public.daily_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  digest_date date NOT NULL,
  open_tasks_count integer DEFAULT 0,
  overdue_tasks_count integer DEFAULT 0,
  tasks_created_today integer DEFAULT 0,
  total_ar_outstanding numeric DEFAULT 0,
  ar_current numeric DEFAULT 0,
  ar_1_30 numeric DEFAULT 0,
  ar_31_60 numeric DEFAULT 0,
  ar_61_90 numeric DEFAULT 0,
  ar_91_120 numeric DEFAULT 0,
  ar_120_plus numeric DEFAULT 0,
  payments_collected_today numeric DEFAULT 0,
  payments_collected_last_7_days numeric DEFAULT 0,
  payments_collected_prev_7_days numeric DEFAULT 0,
  collection_trend text DEFAULT 'flat',
  high_risk_customers_count integer DEFAULT 0,
  high_risk_ar_outstanding numeric DEFAULT 0,
  health_score numeric DEFAULT 100,
  health_label text DEFAULT 'Healthy',
  email_sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, digest_date)
);

-- Enable RLS
ALTER TABLE public.daily_digests ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own digests"
ON public.daily_digests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert digests"
ON public.daily_digests FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update digests"
ON public.daily_digests FOR UPDATE
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_daily_digests_user_date ON public.daily_digests(user_id, digest_date DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_daily_digests_updated_at
BEFORE UPDATE ON public.daily_digests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();