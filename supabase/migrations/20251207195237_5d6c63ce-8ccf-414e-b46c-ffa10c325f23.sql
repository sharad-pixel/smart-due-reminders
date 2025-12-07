-- Add new scoring columns to debtors table for enterprise-grade scoring
ALTER TABLE public.debtors 
ADD COLUMN IF NOT EXISTS collections_health_score numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS collections_risk_score numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS health_tier text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS risk_tier_detailed text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_sentiment_score numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_sentiment_category text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS score_components jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS last_score_change_reason text DEFAULT NULL;

-- Add sentiment tracking to inbound_emails table
ALTER TABLE public.inbound_emails 
ADD COLUMN IF NOT EXISTS ai_sentiment_category text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_sentiment_score numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sentiment_analyzed_at timestamp with time zone DEFAULT NULL;

-- Add score tracking to debtor_risk_history
ALTER TABLE public.debtor_risk_history 
ADD COLUMN IF NOT EXISTS collections_health_score numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS collections_risk_score numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS health_tier text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_sentiment_score numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS score_components jsonb DEFAULT '{}'::jsonb;

-- Create sentiment category enum config table for admin configuration
CREATE TABLE IF NOT EXISTS public.sentiment_score_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL UNIQUE,
  health_score_value numeric NOT NULL DEFAULT 50,
  risk_score_value numeric NOT NULL DEFAULT 50,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sentiment_score_config ENABLE ROW LEVEL SECURITY;

-- Admin-only access to sentiment config
CREATE POLICY "Admins can manage sentiment config" 
ON public.sentiment_score_config 
FOR ALL 
USING (is_recouply_admin(auth.uid()));

CREATE POLICY "Everyone can view sentiment config" 
ON public.sentiment_score_config 
FOR SELECT 
USING (true);

-- Insert default sentiment configurations
INSERT INTO public.sentiment_score_config (category, health_score_value, risk_score_value, description) VALUES
  ('payment_confirmed', 95, 5, 'Customer confirmed payment or paid'),
  ('cooperative', 80, 15, 'Customer is responsive and working with us'),
  ('neutral', 50, 50, 'Neutral communication, no clear signals'),
  ('delaying', 35, 70, 'Customer is delaying but not hostile'),
  ('hardship', 30, 60, 'Customer expressing financial difficulty'),
  ('hostile', 10, 90, 'Hostile or threatening communication'),
  ('no_response', 25, 75, 'No response to outreach attempts')
ON CONFLICT (category) DO NOTHING;

-- Create score change log for auditability
CREATE TABLE IF NOT EXISTS public.score_change_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  debtor_id uuid NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  change_type text NOT NULL,
  old_health_score numeric,
  new_health_score numeric,
  old_risk_score numeric,
  new_risk_score numeric,
  old_health_tier text,
  new_health_tier text,
  change_reason text NOT NULL,
  score_components jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.score_change_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own score change logs
CREATE POLICY "Users can view own score change logs" 
ON public.score_change_logs 
FOR SELECT 
USING (auth.uid() = user_id);

-- System can insert score change logs
CREATE POLICY "System can insert score change logs" 
ON public.score_change_logs 
FOR INSERT 
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_debtors_health_score ON public.debtors(collections_health_score);
CREATE INDEX IF NOT EXISTS idx_debtors_risk_score ON public.debtors(collections_risk_score);
CREATE INDEX IF NOT EXISTS idx_score_change_logs_debtor ON public.score_change_logs(debtor_id);
CREATE INDEX IF NOT EXISTS idx_score_change_logs_created ON public.score_change_logs(created_at DESC);