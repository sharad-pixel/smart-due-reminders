-- Add best-practice debtor fields
ALTER TABLE public.debtors
  ADD COLUMN IF NOT EXISTS primary_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS primary_email TEXT,
  ADD COLUMN IF NOT EXISTS primary_phone TEXT,
  ADD COLUMN IF NOT EXISTS billing_address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS billing_address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS billing_city TEXT,
  ADD COLUMN IF NOT EXISTS billing_state TEXT,
  ADD COLUMN IF NOT EXISTS billing_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS billing_country TEXT,
  ADD COLUMN IF NOT EXISTS ar_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS ar_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS ar_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS external_system TEXT,
  ADD COLUMN IF NOT EXISTS external_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS crm_system TEXT,
  ADD COLUMN IF NOT EXISTS crm_account_id_external TEXT,
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS payment_terms_default TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS total_open_balance NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_risk_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS max_risk_score INTEGER,
  ADD COLUMN IF NOT EXISTS high_risk_invoice_count INTEGER,
  ADD COLUMN IF NOT EXISTS risk_tier TEXT;

-- Migrate existing data to new fields
UPDATE public.debtors
SET 
  primary_contact_name = COALESCE(primary_contact_name, contact_name),
  primary_email = COALESCE(primary_email, email),
  primary_phone = COALESCE(primary_phone, phone),
  billing_address_line1 = COALESCE(billing_address_line1, address),
  total_open_balance = COALESCE(total_open_balance, current_balance, 0),
  is_active = COALESCE(is_active, TRUE);

-- Add unique constraint on primary_email per user (when not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_debtors_user_email 
  ON public.debtors(user_id, primary_email) 
  WHERE primary_email IS NOT NULL;

-- Add index on external_customer_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_debtors_external_customer_id 
  ON public.debtors(user_id, external_customer_id) 
  WHERE external_customer_id IS NOT NULL;

-- Ensure debtor_id in invoices is NOT NULL (update any orphaned invoices first)
-- This should not affect existing data as debtor_id is already required
ALTER TABLE public.invoices 
  ALTER COLUMN debtor_id SET NOT NULL;