
CREATE TABLE public.stripe_reconciliation_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  user_id UUID NOT NULL,
  discrepancy_key TEXT NOT NULL,
  discrepancy_type TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, discrepancy_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_reconciliation_dismissals TO authenticated;
GRANT ALL ON public.stripe_reconciliation_dismissals TO service_role;

ALTER TABLE public.stripe_reconciliation_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own dismissals"
  ON public.stripe_reconciliation_dismissals
  FOR ALL
  USING (auth.uid() = user_id OR auth.uid() = account_id)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = account_id);

CREATE INDEX idx_stripe_recon_dismissals_account ON public.stripe_reconciliation_dismissals(account_id);
