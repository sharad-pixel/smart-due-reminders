
CREATE TABLE public.pending_sheet_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  sheet_template_id UUID,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  company_name TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  industry TEXT,
  type TEXT DEFAULT 'B2B',
  external_customer_id TEXT,
  crm_account_id_external TEXT,
  payment_terms_default TEXT,
  notes TEXT,
  source TEXT,
  sheet_row_number INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_sheet_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pending imports"
  ON public.pending_sheet_imports FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR user_id = public.get_effective_account_id(auth.uid()));

CREATE POLICY "Users can update their own pending imports"
  ON public.pending_sheet_imports FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR user_id = public.get_effective_account_id(auth.uid()));

CREATE POLICY "Users can delete their own pending imports"
  ON public.pending_sheet_imports FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR user_id = public.get_effective_account_id(auth.uid()));

CREATE POLICY "Service role can insert pending imports"
  ON public.pending_sheet_imports FOR INSERT
  TO authenticated
  WITH CHECK (true);
