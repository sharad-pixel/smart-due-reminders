-- Add email_status to debtors if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'debtors' AND column_name = 'email_status') THEN
    ALTER TABLE debtors ADD COLUMN email_status TEXT DEFAULT 'valid';
  END IF;
END$$;

-- Create integration_sync_settings table for sync configuration
CREATE TABLE IF NOT EXISTS integration_sync_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL CHECK (integration_type IN ('stripe', 'quickbooks', 'csv')),
  
  -- What to sync
  sync_customers BOOLEAN DEFAULT true,
  sync_invoices BOOLEAN DEFAULT true,
  sync_payments BOOLEAN DEFAULT true,
  sync_credits BOOLEAN DEFAULT false,
  
  -- Which statuses to include
  include_open BOOLEAN DEFAULT true,
  include_paid BOOLEAN DEFAULT false,
  include_voided BOOLEAN DEFAULT false,
  include_draft BOOLEAN DEFAULT false,
  
  -- Frequency
  sync_frequency TEXT DEFAULT 'manual' CHECK (sync_frequency IN ('manual', 'hourly', 'every_6_hours', 'daily')),
  
  -- Conflict resolution
  conflict_resolution TEXT DEFAULT 'source_wins' CHECK (conflict_resolution IN ('source_wins', 'recouply_wins', 'newest_wins')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, integration_type)
);

-- Enable RLS
ALTER TABLE integration_sync_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users manage own sync settings" ON integration_sync_settings
  FOR ALL USING (user_id = auth.uid());

-- Add enhanced columns to sync logs if not exists
DO $$
BEGIN
  -- Add to quickbooks_sync_log
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'quickbooks_sync_log' AND column_name = 'synced_count') THEN
    ALTER TABLE quickbooks_sync_log ADD COLUMN synced_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'quickbooks_sync_log' AND column_name = 'skipped_count') THEN
    ALTER TABLE quickbooks_sync_log ADD COLUMN skipped_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'quickbooks_sync_log' AND column_name = 'skipped_details') THEN
    ALTER TABLE quickbooks_sync_log ADD COLUMN skipped_details JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'quickbooks_sync_log' AND column_name = 'needs_attention_count') THEN
    ALTER TABLE quickbooks_sync_log ADD COLUMN needs_attention_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'quickbooks_sync_log' AND column_name = 'needs_attention_details') THEN
    ALTER TABLE quickbooks_sync_log ADD COLUMN needs_attention_details JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'quickbooks_sync_log' AND column_name = 'customers_synced') THEN
    ALTER TABLE quickbooks_sync_log ADD COLUMN customers_synced INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'quickbooks_sync_log' AND column_name = 'invoices_synced') THEN
    ALTER TABLE quickbooks_sync_log ADD COLUMN invoices_synced INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'quickbooks_sync_log' AND column_name = 'payments_synced') THEN
    ALTER TABLE quickbooks_sync_log ADD COLUMN payments_synced INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'quickbooks_sync_log' AND column_name = 'contacts_synced') THEN
    ALTER TABLE quickbooks_sync_log ADD COLUMN contacts_synced INTEGER DEFAULT 0;
  END IF;

  -- Add to stripe_sync_log
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'stripe_sync_log' AND column_name = 'synced_count') THEN
    ALTER TABLE stripe_sync_log ADD COLUMN synced_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'stripe_sync_log' AND column_name = 'skipped_count') THEN
    ALTER TABLE stripe_sync_log ADD COLUMN skipped_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'stripe_sync_log' AND column_name = 'skipped_details') THEN
    ALTER TABLE stripe_sync_log ADD COLUMN skipped_details JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'stripe_sync_log' AND column_name = 'needs_attention_count') THEN
    ALTER TABLE stripe_sync_log ADD COLUMN needs_attention_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'stripe_sync_log' AND column_name = 'needs_attention_details') THEN
    ALTER TABLE stripe_sync_log ADD COLUMN needs_attention_details JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'stripe_sync_log' AND column_name = 'customers_synced') THEN
    ALTER TABLE stripe_sync_log ADD COLUMN customers_synced INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'stripe_sync_log' AND column_name = 'invoices_synced') THEN
    ALTER TABLE stripe_sync_log ADD COLUMN invoices_synced INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'stripe_sync_log' AND column_name = 'payments_synced') THEN
    ALTER TABLE stripe_sync_log ADD COLUMN payments_synced INTEGER DEFAULT 0;
  END IF;
END$$;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_integration_sync_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS update_integration_sync_settings_updated_at ON integration_sync_settings;
CREATE TRIGGER update_integration_sync_settings_updated_at
  BEFORE UPDATE ON integration_sync_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_sync_settings_updated_at();