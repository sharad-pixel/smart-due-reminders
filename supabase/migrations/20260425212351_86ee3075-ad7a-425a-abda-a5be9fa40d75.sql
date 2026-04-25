ALTER TABLE public.debtors
ADD COLUMN IF NOT EXISTS duns_number text;

CREATE INDEX IF NOT EXISTS idx_debtors_duns_number
  ON public.debtors (duns_number)
  WHERE duns_number IS NOT NULL;

COMMENT ON COLUMN public.debtors.duns_number IS 'Dun & Bradstreet D-U-N-S number (9-digit identifier). Populated via D&B integration (Enterprise) or manual entry.';