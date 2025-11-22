-- Add overage_amount column to plans table
ALTER TABLE plans ADD COLUMN IF NOT EXISTS overage_amount numeric;

-- Create invoice_usage table for tracking monthly usage
CREATE TABLE IF NOT EXISTS public.invoice_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month text NOT NULL, -- Format: YYYY-MM
  included_invoices_used integer NOT NULL DEFAULT 0,
  overage_invoices integer NOT NULL DEFAULT 0,
  overage_charges_total numeric NOT NULL DEFAULT 0,
  last_updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, month)
);

-- Enable RLS on invoice_usage
ALTER TABLE public.invoice_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoice_usage
CREATE POLICY "Users can view own usage"
  ON public.invoice_usage
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON public.invoice_usage
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
  ON public.invoice_usage
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoice_usage_user_month ON public.invoice_usage(user_id, month);

-- Add overage flag to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_overage boolean DEFAULT false;

-- Update plans data with new pricing
UPDATE plans SET monthly_price = 99, invoice_limit = 50, overage_amount = 1.00 WHERE name = 'Starter';
UPDATE plans SET monthly_price = 199, invoice_limit = 200, overage_amount = 1.00 WHERE name = 'Growth';
UPDATE plans SET monthly_price = 399, invoice_limit = 500, overage_amount = 1.00 WHERE name = 'Professional';

-- Update feature flags for plans
UPDATE plans SET feature_flags = jsonb_build_object(
  'can_auto_sms', false,
  'can_use_crm_context', false,
  'can_use_cadence_auto', false,
  'can_have_team_users', false,
  'can_use_unlimited_invoices', false
) WHERE name = 'Starter';

UPDATE plans SET feature_flags = jsonb_build_object(
  'can_auto_sms', true,
  'can_use_crm_context', false,
  'can_use_cadence_auto', true,
  'can_have_team_users', true,
  'can_use_unlimited_invoices', false
) WHERE name = 'Growth';

UPDATE plans SET feature_flags = jsonb_build_object(
  'can_auto_sms', true,
  'can_use_crm_context', true,
  'can_use_cadence_auto', true,
  'can_have_team_users', true,
  'can_use_unlimited_invoices', false
) WHERE name = 'Professional';

UPDATE plans SET 
  monthly_price = NULL, 
  invoice_limit = NULL, 
  overage_amount = NULL,
  feature_flags = jsonb_build_object(
    'can_auto_sms', true,
    'can_use_crm_context', true,
    'can_use_cadence_auto', true,
    'can_have_team_users', true,
    'can_use_unlimited_invoices', true
  ) 
WHERE name = 'Bespoke';