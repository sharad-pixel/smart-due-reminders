
-- Phase 1: Document Classification + Agreement Hierarchy
ALTER TABLE public.live_contract_imports
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS document_type_confidence numeric(5,2),
  ADD COLUMN IF NOT EXISTS agreement_number text,
  ADD COLUMN IF NOT EXISTS document_version text,
  ADD COLUMN IF NOT EXISTS parent_import_id uuid REFERENCES public.live_contract_imports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS classified_at timestamp with time zone;

ALTER TABLE public.live_contract_imports
  DROP CONSTRAINT IF EXISTS live_contract_imports_document_type_check;

ALTER TABLE public.live_contract_imports
  ADD CONSTRAINT live_contract_imports_document_type_check CHECK (
    document_type IS NULL OR document_type = ANY (ARRAY[
      'msa','order_form','amendment','renewal_order','expansion_order','reduction_order',
      'sow','pricing_exhibit','purchase_order','invoice','credit_memo','usage_report',
      'change_order','professional_services_agreement','baa','dpa','other'
    ])
  );

CREATE INDEX IF NOT EXISTS idx_lc_imports_parent ON public.live_contract_imports(parent_import_id) WHERE parent_import_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lc_imports_agreement_number ON public.live_contract_imports(account_id, agreement_number) WHERE agreement_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lc_imports_document_type ON public.live_contract_imports(account_id, document_type) WHERE document_type IS NOT NULL;
