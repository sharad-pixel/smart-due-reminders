-- Add normalized status and collectibility fields for one-directional sync architecture
-- Recouply is a READ-ONLY aggregation layer - these fields normalize source system data

-- Add normalized_status to invoices for collection logic
DO $$ BEGIN
  ALTER TABLE invoices ADD COLUMN normalized_status TEXT DEFAULT 'open'
    CHECK (normalized_status IN ('open', 'paid', 'partially_paid', 'terminal'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add is_collectible flag for collection workflow eligibility
DO $$ BEGIN
  ALTER TABLE invoices ADD COLUMN is_collectible BOOLEAN DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add terminal_reason for voided/written-off invoices
DO $$ BEGIN
  ALTER TABLE invoices ADD COLUMN terminal_reason TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add payment_origin for tracking how invoices were settled
DO $$ BEGIN
  ALTER TABLE invoices ADD COLUMN payment_origin TEXT
    CHECK (payment_origin IN ('stripe_payment', 'quickbooks_payment', 'external_settlement', 'credit_applied', 'written_off', 'voided'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Ensure source_system exists on invoices
DO $$ BEGIN
  ALTER TABLE invoices ADD COLUMN source_system TEXT
    CHECK (source_system IN ('stripe', 'quickbooks', 'manual', 'csv_import'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add source_system to debtors if not exists
DO $$ BEGIN
  ALTER TABLE debtors ADD COLUMN source_system TEXT
    CHECK (source_system IN ('stripe', 'quickbooks', 'manual', 'csv_import'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add email_status to debtors if not exists (for flagging missing emails)
DO $$ BEGIN
  ALTER TABLE debtors ADD COLUMN email_status TEXT DEFAULT 'valid'
    CHECK (email_status IN ('valid', 'missing', 'invalid', 'bounced'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add sync metrics to stripe_sync_log
DO $$ BEGIN
  ALTER TABLE stripe_sync_log ADD COLUMN invoices_synced INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE stripe_sync_log ADD COLUMN invoices_skipped INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE stripe_sync_log ADD COLUMN invoices_terminal INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE stripe_sync_log ADD COLUMN paid_without_payment INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE stripe_sync_log ADD COLUMN customers_synced INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add sync metrics to quickbooks_sync_log
DO $$ BEGIN
  ALTER TABLE quickbooks_sync_log ADD COLUMN invoices_synced INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE quickbooks_sync_log ADD COLUMN invoices_skipped INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE quickbooks_sync_log ADD COLUMN invoices_terminal INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE quickbooks_sync_log ADD COLUMN customers_synced INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE quickbooks_sync_log ADD COLUMN contacts_synced INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE quickbooks_sync_log ADD COLUMN payments_synced INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Update existing invoices with normalized status based on current status
UPDATE invoices SET 
  normalized_status = CASE 
    WHEN status IN ('Voided', 'Canceled') THEN 'terminal'
    WHEN status = 'Paid' THEN 'paid'
    WHEN status = 'PartiallyPaid' THEN 'partially_paid'
    ELSE 'open'
  END,
  is_collectible = CASE 
    WHEN status IN ('Voided', 'Canceled', 'Paid') THEN false
    ELSE true
  END,
  terminal_reason = CASE 
    WHEN status = 'Voided' THEN 'voided_in_source'
    WHEN status = 'Canceled' THEN 'written_off'
    ELSE NULL
  END
WHERE normalized_status IS NULL OR normalized_status = 'open';

-- Add index for collection queries
CREATE INDEX IF NOT EXISTS idx_invoices_collectible ON invoices(is_collectible, normalized_status) WHERE is_collectible = true;

-- Add comment explaining one-directional sync architecture
COMMENT ON TABLE invoices IS 'Invoices synced from source systems (Stripe, QuickBooks). Recouply is READ-ONLY - no data flows back to source systems.';
COMMENT ON COLUMN invoices.normalized_status IS 'Normalized status for collection logic: open, paid, partially_paid, terminal';
COMMENT ON COLUMN invoices.is_collectible IS 'Whether invoice is eligible for collection workflows. Terminal/paid invoices are not collectible.';
COMMENT ON COLUMN invoices.payment_origin IS 'How the invoice was settled: stripe_payment, external_settlement, credit_applied, etc.';