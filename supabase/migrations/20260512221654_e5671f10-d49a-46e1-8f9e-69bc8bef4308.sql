-- 1. Link invoices back to their originating contract / OCR / CLM source
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS source_contract_id uuid REFERENCES public.live_contract_imports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_contract_schedule_id uuid REFERENCES public.contract_invoice_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_clm_instance_id uuid REFERENCES public.clm_template_instances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_origin text;

CREATE INDEX IF NOT EXISTS idx_invoices_source_contract_id ON public.invoices(source_contract_id);
CREATE INDEX IF NOT EXISTS idx_invoices_source_contract_schedule_id ON public.invoices(source_contract_schedule_id);
CREATE INDEX IF NOT EXISTS idx_invoices_source_clm_instance_id ON public.invoices(source_clm_instance_id);

-- 2. Audit trail of every AI-extracted / exported data point that fed an invoice
CREATE TABLE IF NOT EXISTS public.invoice_data_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  organization_id uuid,
  source_type text NOT NULL,           -- 'contract_intelligence' | 'ocr_contract' | 'clm' | 'manual' | 'ai_extract'
  source_contract_id uuid REFERENCES public.live_contract_imports(id) ON DELETE SET NULL,
  source_schedule_id uuid REFERENCES public.contract_invoice_schedules(id) ON DELETE SET NULL,
  source_clm_instance_id uuid REFERENCES public.clm_template_instances(id) ON DELETE SET NULL,
  source_reference text,               -- e.g. file name, schedule id text, AI run id
  field_name text NOT NULL,            -- e.g. 'amount', 'due_date', 'invoice_number'
  source_value text,                   -- raw value as captured by AI / OCR / CLM
  applied_value text,                  -- value actually written to the invoice
  ai_confidence numeric,               -- 0-1 confidence if available
  is_overridden boolean NOT NULL DEFAULT false,
  duplicate_of_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_data_audit_invoice_id ON public.invoice_data_audit(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_data_audit_user_id ON public.invoice_data_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_data_audit_source_contract_id ON public.invoice_data_audit(source_contract_id);

ALTER TABLE public.invoice_data_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their invoice audit"
  ON public.invoice_data_audit FOR SELECT
  USING (auth.uid() = user_id OR public.can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Users insert their invoice audit"
  ON public.invoice_data_audit FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.can_write_as_account(auth.uid(), user_id));

CREATE POLICY "Service role manages invoice audit"
  ON public.invoice_data_audit FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');