-- Supporting documents (MSA, DPA, expansions, amendments, SOWs, etc.) attached to a contract import
CREATE TABLE public.live_contract_supporting_docs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  import_id UUID NOT NULL REFERENCES public.live_contract_imports(id) ON DELETE CASCADE,
  uploaded_by UUID,
  doc_type TEXT NOT NULL DEFAULT 'other',
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_lc_supporting_docs_import ON public.live_contract_supporting_docs(import_id);
CREATE INDEX idx_lc_supporting_docs_account ON public.live_contract_supporting_docs(account_id);

ALTER TABLE public.live_contract_supporting_docs ENABLE ROW LEVEL SECURITY;

-- Users can manage supporting docs for contracts in their effective account
CREATE POLICY "Users can view supporting docs in their account"
ON public.live_contract_supporting_docs
FOR SELECT
TO authenticated
USING (account_id = public.get_effective_account_id(auth.uid()));

CREATE POLICY "Users can insert supporting docs in their account"
ON public.live_contract_supporting_docs
FOR INSERT
TO authenticated
WITH CHECK (account_id = public.get_effective_account_id(auth.uid()));

CREATE POLICY "Users can update supporting docs in their account"
ON public.live_contract_supporting_docs
FOR UPDATE
TO authenticated
USING (account_id = public.get_effective_account_id(auth.uid()));

CREATE POLICY "Users can delete supporting docs in their account"
ON public.live_contract_supporting_docs
FOR DELETE
TO authenticated
USING (account_id = public.get_effective_account_id(auth.uid()));

CREATE TRIGGER update_lc_supporting_docs_updated_at
BEFORE UPDATE ON public.live_contract_supporting_docs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();