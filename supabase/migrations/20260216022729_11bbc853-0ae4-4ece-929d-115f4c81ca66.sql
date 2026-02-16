
-- Add subscription and usage fields to daily_digests
ALTER TABLE public.daily_digests
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS plan_type text,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS billing_interval text,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_allowance integer,
  ADD COLUMN IF NOT EXISTS invoices_used integer,
  ADD COLUMN IF NOT EXISTS overage_invoices integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_quota integer,
  ADD COLUMN IF NOT EXISTS is_over_limit boolean DEFAULT false;
