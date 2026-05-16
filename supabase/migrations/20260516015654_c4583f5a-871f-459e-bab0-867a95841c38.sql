ALTER TABLE public.live_contract_imports
  ADD COLUMN IF NOT EXISTS metrics_jsonb jsonb,
  ADD COLUMN IF NOT EXISTS metrics_computed_at timestamptz;