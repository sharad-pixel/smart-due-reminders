-- Create RCA (Revenue/Collections Account) records table
CREATE TABLE public.rca_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  debtor_id UUID NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  external_rca_id TEXT,
  contract_name TEXT,
  mrr NUMERIC,
  arr NUMERIC,
  contract_start_date DATE,
  contract_end_date DATE,
  renewal_date DATE,
  risk_category TEXT DEFAULT 'medium',
  health_score TEXT,
  account_owner TEXT,
  csm_name TEXT,
  csm_email TEXT,
  contract_status TEXT DEFAULT 'active',
  source_system TEXT,
  raw_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create CS (Customer Success) cases table
CREATE TABLE public.cs_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  debtor_id UUID NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  external_case_id TEXT,
  case_number TEXT,
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  case_type TEXT,
  case_origin TEXT,
  source_system TEXT DEFAULT 'manual',
  assigned_to TEXT,
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  resolution TEXT,
  notes TEXT,
  raw_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rca_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_cases ENABLE ROW LEVEL SECURITY;

-- RLS policies for rca_records
CREATE POLICY "Users can view own RCA records" ON public.rca_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own RCA records" ON public.rca_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own RCA records" ON public.rca_records
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own RCA records" ON public.rca_records
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for cs_cases
CREATE POLICY "Users can view own CS cases" ON public.cs_cases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own CS cases" ON public.cs_cases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own CS cases" ON public.cs_cases
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own CS cases" ON public.cs_cases
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_rca_records_debtor_id ON public.rca_records(debtor_id);
CREATE INDEX idx_rca_records_user_id ON public.rca_records(user_id);
CREATE INDEX idx_cs_cases_debtor_id ON public.cs_cases(debtor_id);
CREATE INDEX idx_cs_cases_invoice_id ON public.cs_cases(invoice_id);
CREATE INDEX idx_cs_cases_user_id ON public.cs_cases(user_id);
CREATE INDEX idx_cs_cases_status ON public.cs_cases(status);

-- Triggers for updated_at
CREATE TRIGGER update_rca_records_updated_at
  BEFORE UPDATE ON public.rca_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cs_cases_updated_at
  BEFORE UPDATE ON public.cs_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();