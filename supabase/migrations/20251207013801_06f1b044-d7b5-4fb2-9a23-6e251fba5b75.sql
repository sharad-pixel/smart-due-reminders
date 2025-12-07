-- Add billing_interval and related fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'month' CHECK (billing_interval IN ('month', 'year')),
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.billing_interval IS 'Billing frequency: month or year. Annual billing receives 20% discount.';
COMMENT ON COLUMN public.profiles.cancel_at_period_end IS 'Whether subscription will cancel at end of current period';
COMMENT ON COLUMN public.profiles.current_period_end IS 'End date of current billing period from Stripe';