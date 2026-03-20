
-- Engagement scores table - tracks debtor engagement metrics from inbound communications
CREATE TABLE public.engagement_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debtor_id uuid NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  engagement_score integer NOT NULL DEFAULT 50,
  has_responded boolean NOT NULL DEFAULT false,
  last_response_date timestamptz,
  response_recency_days integer,
  engagement_cadence text DEFAULT 'none',
  conversation_state text DEFAULT 'no_response',
  response_type text,
  broken_promises_count integer DEFAULT 0,
  payment_intent_detected boolean DEFAULT false,
  score_breakdown jsonb DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(debtor_id)
);

-- Invoice risk scores table - per-invoice risk with ECL
CREATE TABLE public.invoice_risk_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  debtor_id uuid NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  collectability_score integer NOT NULL DEFAULT 50,
  collectability_tier text NOT NULL DEFAULT 'Moderate',
  aging_penalty numeric DEFAULT 0,
  behavioral_penalty numeric DEFAULT 0,
  status_penalty numeric DEFAULT 0,
  engagement_boost numeric DEFAULT 0,
  probability_of_default numeric DEFAULT 0.05,
  expected_credit_loss numeric DEFAULT 0,
  engagement_adjusted_pd numeric DEFAULT 0.05,
  engagement_adjusted_ecl numeric DEFAULT 0,
  risk_factors jsonb DEFAULT '[]'::jsonb,
  ai_summary text,
  recommended_action text,
  payment_likelihood text DEFAULT 'Moderate',
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(invoice_id)
);

-- Debtor risk profiles table - aggregate risk profile per debtor
CREATE TABLE public.debtor_risk_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debtor_id uuid NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  overall_collectability_score integer DEFAULT 50,
  total_open_balance numeric DEFAULT 0,
  total_ecl numeric DEFAULT 0,
  total_engagement_adjusted_ecl numeric DEFAULT 0,
  avg_probability_of_default numeric DEFAULT 0.05,
  engagement_level text DEFAULT 'none',
  engagement_risk_impact text DEFAULT 'neutral',
  risk_classification text DEFAULT 'moderate',
  open_invoice_count integer DEFAULT 0,
  overdue_invoice_count integer DEFAULT 0,
  avg_days_past_due numeric DEFAULT 0,
  ai_risk_summary text,
  ai_recommendations jsonb DEFAULT '[]'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(debtor_id)
);

-- Enable RLS on all new tables
ALTER TABLE public.engagement_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debtor_risk_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can view their own data
CREATE POLICY "Users can view own engagement scores"
  ON public.engagement_scores FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Service role can manage engagement scores"
  ON public.engagement_scores FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own invoice risk scores"
  ON public.invoice_risk_scores FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Service role can manage invoice risk scores"
  ON public.invoice_risk_scores FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own debtor risk profiles"
  ON public.debtor_risk_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Service role can manage debtor risk profiles"
  ON public.debtor_risk_profiles FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_engagement_scores_debtor ON public.engagement_scores(debtor_id);
CREATE INDEX idx_engagement_scores_user ON public.engagement_scores(user_id);
CREATE INDEX idx_invoice_risk_scores_invoice ON public.invoice_risk_scores(invoice_id);
CREATE INDEX idx_invoice_risk_scores_debtor ON public.invoice_risk_scores(debtor_id);
CREATE INDEX idx_invoice_risk_scores_user ON public.invoice_risk_scores(user_id);
CREATE INDEX idx_debtor_risk_profiles_debtor ON public.debtor_risk_profiles(debtor_id);
CREATE INDEX idx_debtor_risk_profiles_user ON public.debtor_risk_profiles(user_id);
