
ALTER TABLE public.live_contract_imports
  ADD COLUMN IF NOT EXISTS progress_pct integer DEFAULT 0;
