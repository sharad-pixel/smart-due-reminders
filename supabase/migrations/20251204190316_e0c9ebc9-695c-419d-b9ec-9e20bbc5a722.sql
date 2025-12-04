-- Add risk engine fields to debtors table (some already exist, adding new ones)
ALTER TABLE public.debtors 
ADD COLUMN IF NOT EXISTS risk_status_note text,
ADD COLUMN IF NOT EXISTS risk_last_calculated_at timestamptz;

-- Create debtor risk history table for tracking scores over time
CREATE TABLE public.debtor_risk_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debtor_id uuid NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  risk_payment_score numeric,
  risk_tier text,
  risk_status_note text,
  basis_invoices_count integer DEFAULT 0,
  basis_payments_count integer DEFAULT 0,
  basis_days_observed integer DEFAULT 0,
  calculation_details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.debtor_risk_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for debtor_risk_history
CREATE POLICY "Users can view own risk history"
  ON public.debtor_risk_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own risk history"
  ON public.debtor_risk_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own risk history"
  ON public.debtor_risk_history
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_debtor_risk_history_debtor_id ON public.debtor_risk_history(debtor_id);
CREATE INDEX idx_debtor_risk_history_snapshot_at ON public.debtor_risk_history(snapshot_at DESC);
CREATE INDEX idx_debtor_risk_history_user_id ON public.debtor_risk_history(user_id);