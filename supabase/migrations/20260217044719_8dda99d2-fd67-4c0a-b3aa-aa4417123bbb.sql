-- Add currency column to payment_plans
ALTER TABLE public.payment_plans ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';