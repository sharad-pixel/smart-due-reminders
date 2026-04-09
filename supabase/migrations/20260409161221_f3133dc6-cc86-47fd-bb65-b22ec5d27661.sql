
CREATE TABLE public.debtor_ai_context (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  debtor_id UUID NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  -- Structured fields
  industry TEXT,
  employee_count TEXT,
  annual_revenue TEXT,
  payment_preferences TEXT,
  known_issues TEXT,
  business_relationship TEXT,
  financial_health_notes TEXT,
  communication_preference TEXT,
  decision_maker TEXT,
  seasonal_patterns TEXT,
  -- Free-form
  additional_context TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One context per debtor
  UNIQUE(debtor_id)
);

ALTER TABLE public.debtor_ai_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI context"
  ON public.debtor_ai_context FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.can_access_account_data(auth.uid(), user_id)
  );

CREATE POLICY "Users can insert own AI context"
  ON public.debtor_ai_context FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own AI context"
  ON public.debtor_ai_context FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own AI context"
  ON public.debtor_ai_context FOR DELETE
  USING (user_id = auth.uid());

CREATE TRIGGER update_debtor_ai_context_updated_at
  BEFORE UPDATE ON public.debtor_ai_context
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
