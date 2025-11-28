-- Add is_archived column to debtors table
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Add is_archived column to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Create index for better query performance on archived debtors
CREATE INDEX IF NOT EXISTS idx_debtors_is_archived ON debtors(is_archived);

-- Create index for better query performance on archived invoices
CREATE INDEX IF NOT EXISTS idx_invoices_is_archived ON invoices(is_archived);