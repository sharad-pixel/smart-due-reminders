
-- Compliance documents table
CREATE TABLE IF NOT EXISTS public.compliance_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  asc_standard TEXT NOT NULL DEFAULT 'ASC 606',
  doc_category TEXT,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  byte_size BIGINT,
  page_count INTEGER,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | indexing | indexed | failed
  error TEXT,
  summary TEXT,
  extracted_text TEXT,
  key_policies JSONB,
  credits_charged NUMERIC(14,2) DEFAULT 0,
  payment_method TEXT,
  model_version TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  indexed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_compliance_documents_account ON public.compliance_documents(account_id, asc_standard, created_at DESC);

ALTER TABLE public.compliance_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members view compliance docs"
ON public.compliance_documents FOR SELECT TO authenticated
USING (can_access_account_data(auth.uid(), account_id));

CREATE POLICY "Owners and admins manage compliance docs"
ON public.compliance_documents FOR ALL TO authenticated
USING (public.is_asc606_admin(auth.uid(), account_id))
WITH CHECK (public.is_asc606_admin(auth.uid(), account_id));

CREATE TRIGGER trg_compliance_documents_updated
BEFORE UPDATE ON public.compliance_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('compliance-documents', 'compliance-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Account members read compliance docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'compliance-documents'
  AND EXISTS (
    SELECT 1 FROM public.compliance_documents cd
    WHERE cd.storage_path = storage.objects.name
      AND can_access_account_data(auth.uid(), cd.account_id)
  )
);

CREATE POLICY "Admins upload compliance docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'compliance-documents');

CREATE POLICY "Admins update compliance docs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'compliance-documents');

CREATE POLICY "Admins delete compliance docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'compliance-documents');

-- Extend ledger kind constraint to record indexing usage
ALTER TABLE public.asc606_credit_ledger DROP CONSTRAINT IF EXISTS asc606_credit_ledger_kind_check;
ALTER TABLE public.asc606_credit_ledger ADD CONSTRAINT asc606_credit_ledger_kind_check
  CHECK (kind = ANY (ARRAY['purchase','consume','overage_accrue','overage_invoice','refund','adjustment','compliance_doc_indexing']));
