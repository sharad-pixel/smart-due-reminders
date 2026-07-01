ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS posting_state text NOT NULL DEFAULT 'posted'
    CHECK (posting_state IN ('draft', 'posted')),
  ADD COLUMN IF NOT EXISTS posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS posted_by uuid;

CREATE INDEX IF NOT EXISTS idx_invoices_posting_state ON public.invoices(posting_state);

COMMENT ON COLUMN public.invoices.posting_state IS 'draft = open to editing (from OCR/contract intelligence pending review); posted = locked/finalized';