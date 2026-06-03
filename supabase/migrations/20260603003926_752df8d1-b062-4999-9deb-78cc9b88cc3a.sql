
ALTER TABLE public.live_contract_imports
  ADD COLUMN IF NOT EXISTS primary_role text,
  ADD COLUMN IF NOT EXISTS awaiting_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS superseded_by_id uuid REFERENCES public.live_contract_imports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS supersedes_reason text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'live_contract_imports_primary_role_check'
  ) THEN
    ALTER TABLE public.live_contract_imports
      ADD CONSTRAINT live_contract_imports_primary_role_check
      CHECK (primary_role IS NULL OR primary_role IN ('primary','supplemental','standalone'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lc_imports_awaiting_primary
  ON public.live_contract_imports(account_id) WHERE awaiting_primary = true;

CREATE INDEX IF NOT EXISTS idx_lc_imports_superseded_by
  ON public.live_contract_imports(superseded_by_id) WHERE superseded_by_id IS NOT NULL;

ALTER TABLE public.live_contract_links DROP CONSTRAINT IF EXISTS live_contract_links_type_check;
ALTER TABLE public.live_contract_links
  ADD CONSTRAINT live_contract_links_type_check
  CHECK (link_type IN ('supplemental','expansion','amendment','renewal','sow','order_form','addendum','replacement','supersedes'));
