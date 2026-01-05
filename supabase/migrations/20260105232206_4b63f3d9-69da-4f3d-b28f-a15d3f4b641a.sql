-- Create QuickBooks payments table
CREATE TABLE public.quickbooks_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  debtor_id UUID REFERENCES public.debtors(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  quickbooks_payment_id TEXT NOT NULL,
  quickbooks_invoice_id TEXT,
  amount_applied INTEGER NOT NULL, -- cents
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_date DATE,
  payment_method TEXT,
  reference_number TEXT,
  source TEXT NOT NULL DEFAULT 'quickbooks',
  raw JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index for payment line items (one payment can apply to multiple invoices)
CREATE UNIQUE INDEX idx_qb_payments_unique 
  ON public.quickbooks_payments(user_id, quickbooks_payment_id, quickbooks_invoice_id);

-- Create indexes for common lookups
CREATE INDEX idx_qb_payments_user ON public.quickbooks_payments(user_id);
CREATE INDEX idx_qb_payments_debtor ON public.quickbooks_payments(debtor_id);
CREATE INDEX idx_qb_payments_invoice ON public.quickbooks_payments(invoice_id);
CREATE INDEX idx_qb_payments_date ON public.quickbooks_payments(payment_date);

-- Enable Row Level Security
ALTER TABLE public.quickbooks_payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own QB payments" 
  ON public.quickbooks_payments 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own QB payments" 
  ON public.quickbooks_payments 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own QB payments" 
  ON public.quickbooks_payments 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own QB payments" 
  ON public.quickbooks_payments 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_qb_payments_updated_at
  BEFORE UPDATE ON public.quickbooks_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();