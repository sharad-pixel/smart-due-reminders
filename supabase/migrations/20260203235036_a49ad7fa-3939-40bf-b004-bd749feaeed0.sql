-- Create payment_plans table to store payment plan configurations
CREATE TABLE public.payment_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  debtor_id UUID NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  
  -- Plan details
  plan_name TEXT,
  total_amount NUMERIC NOT NULL,
  number_of_installments INTEGER NOT NULL DEFAULT 3,
  installment_amount NUMERIC NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly', -- weekly, bi-weekly, monthly
  start_date DATE NOT NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'draft', -- draft, proposed, accepted, active, completed, cancelled, defaulted
  proposed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Linked invoices
  invoice_ids JSONB DEFAULT '[]'::jsonb,
  
  -- AR dashboard link
  public_token UUID DEFAULT gen_random_uuid(),
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create payment_plan_installments table to track individual payments
CREATE TABLE public.payment_plan_installments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_plan_id UUID NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, overdue, cancelled
  paid_at TIMESTAMPTZ,
  payment_id UUID REFERENCES public.payments(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plan_installments ENABLE ROW LEVEL SECURITY;

-- RLS policies for payment_plans
CREATE POLICY "Users can view their own payment plans"
ON public.payment_plans FOR SELECT
USING (can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Users can create their own payment plans"
ON public.payment_plans FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own payment plans"
ON public.payment_plans FOR UPDATE
USING (can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Users can delete their own payment plans"
ON public.payment_plans FOR DELETE
USING (can_access_account_data(auth.uid(), user_id));

-- RLS policies for payment_plan_installments
CREATE POLICY "Users can view installments for their plans"
ON public.payment_plan_installments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.payment_plans pp
    WHERE pp.id = payment_plan_id
    AND can_access_account_data(auth.uid(), pp.user_id)
  )
);

CREATE POLICY "Users can create installments for their plans"
ON public.payment_plan_installments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.payment_plans pp
    WHERE pp.id = payment_plan_id
    AND can_access_account_data(auth.uid(), pp.user_id)
  )
);

CREATE POLICY "Users can update installments for their plans"
ON public.payment_plan_installments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.payment_plans pp
    WHERE pp.id = payment_plan_id
    AND can_access_account_data(auth.uid(), pp.user_id)
  )
);

CREATE POLICY "Users can delete installments for their plans"
ON public.payment_plan_installments FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.payment_plans pp
    WHERE pp.id = payment_plan_id
    AND can_access_account_data(auth.uid(), pp.user_id)
  )
);

-- Trigger to update updated_at
CREATE TRIGGER update_payment_plans_updated_at
BEFORE UPDATE ON public.payment_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_plan_installments_updated_at
BEFORE UPDATE ON public.payment_plan_installments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_payment_plans_debtor_id ON public.payment_plans(debtor_id);
CREATE INDEX idx_payment_plans_user_id ON public.payment_plans(user_id);
CREATE INDEX idx_payment_plans_status ON public.payment_plans(status);
CREATE INDEX idx_payment_plans_public_token ON public.payment_plans(public_token);
CREATE INDEX idx_payment_plan_installments_plan_id ON public.payment_plan_installments(payment_plan_id);
CREATE INDEX idx_payment_plan_installments_status ON public.payment_plan_installments(status);