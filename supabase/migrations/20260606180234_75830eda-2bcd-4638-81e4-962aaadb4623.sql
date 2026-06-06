
-- Add 'launch' to plan_type enum (new $29 entry tier)
ALTER TYPE public.plan_type ADD VALUE IF NOT EXISTS 'launch';

-- Add Credit Economy v2 columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credit_allotment integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS included_contracts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_contract_count integer DEFAULT 0;

COMMENT ON COLUMN public.profiles.credit_allotment IS 'Monthly credit allotment from current plan (1 credit = 1 invoice). -1 = unlimited (enterprise).';
COMMENT ON COLUMN public.profiles.included_contracts IS 'Live Contracts included free in current plan; usage above this is billed at $5/contract/mo.';
COMMENT ON COLUMN public.profiles.active_contract_count IS 'Most recent count of active live contracts (refreshed by nightly meter job).';
