-- Create invoice_transactions table for full transaction history
CREATE TABLE public.invoice_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('payment', 'credit', 'write_off', 'adjustment', 'refund', 'reversal')),
  amount NUMERIC NOT NULL,
  balance_after NUMERIC,
  reference_number TEXT,
  payment_method TEXT,
  reason TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.invoice_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own and team invoice transactions"
  ON public.invoice_transactions
  FOR SELECT
  USING (can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Users can create transactions for own or team account"
  ON public.invoice_transactions
  FOR INSERT
  WITH CHECK (user_id = get_effective_account_id(auth.uid()));

CREATE POLICY "Users can update own and team transactions"
  ON public.invoice_transactions
  FOR UPDATE
  USING (can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Users can delete own and team transactions"
  ON public.invoice_transactions
  FOR DELETE
  USING (can_access_account_data(auth.uid(), user_id));

-- Create index for faster lookups
CREATE INDEX idx_invoice_transactions_invoice_id ON public.invoice_transactions(invoice_id);
CREATE INDEX idx_invoice_transactions_user_id ON public.invoice_transactions(user_id);
CREATE INDEX idx_invoice_transactions_type ON public.invoice_transactions(transaction_type);

-- Add comments
COMMENT ON TABLE public.invoice_transactions IS 'Full transaction history for invoices including payments, credits, write-offs';
COMMENT ON COLUMN public.invoice_transactions.transaction_type IS 'Type: payment, credit, write_off, adjustment, refund, reversal';
COMMENT ON COLUMN public.invoice_transactions.balance_after IS 'Outstanding balance after this transaction';