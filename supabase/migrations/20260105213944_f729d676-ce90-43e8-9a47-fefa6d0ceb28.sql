-- Add QuickBooks columns to profiles table (per-account storage)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS quickbooks_realm_id TEXT,
ADD COLUMN IF NOT EXISTS quickbooks_access_token TEXT,
ADD COLUMN IF NOT EXISTS quickbooks_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS quickbooks_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS quickbooks_company_name TEXT,
ADD COLUMN IF NOT EXISTS quickbooks_connected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS quickbooks_last_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS quickbooks_sync_enabled BOOLEAN DEFAULT true;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_profiles_qb_realm ON profiles(quickbooks_realm_id) WHERE quickbooks_realm_id IS NOT NULL;

-- Add QuickBooks columns to debtors table for customer linking
ALTER TABLE debtors
ADD COLUMN IF NOT EXISTS quickbooks_customer_id TEXT,
ADD COLUMN IF NOT EXISTS quickbooks_sync_token TEXT;

CREATE INDEX IF NOT EXISTS idx_debtors_qb_customer ON debtors(quickbooks_customer_id) WHERE quickbooks_customer_id IS NOT NULL;

-- Add QuickBooks columns to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS quickbooks_invoice_id TEXT,
ADD COLUMN IF NOT EXISTS quickbooks_doc_number TEXT;

CREATE INDEX IF NOT EXISTS idx_invoices_qb_id ON invoices(quickbooks_invoice_id) WHERE quickbooks_invoice_id IS NOT NULL;

-- Create QuickBooks sync log table
CREATE TABLE IF NOT EXISTS quickbooks_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('customers', 'invoices', 'payments', 'full')),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  records_synced INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  errors JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'partial', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE quickbooks_sync_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for quickbooks_sync_log
CREATE POLICY "Users can view own QB sync logs"
  ON quickbooks_sync_log FOR SELECT
  USING (user_id = auth.uid() OR public.can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Users can insert own QB sync logs"
  ON quickbooks_sync_log FOR INSERT
  WITH CHECK (user_id = auth.uid());