
CREATE INDEX IF NOT EXISTS idx_documents_org ON public.documents (organization_id, category);
