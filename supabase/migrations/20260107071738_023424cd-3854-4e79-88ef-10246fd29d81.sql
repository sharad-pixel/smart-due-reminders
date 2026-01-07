-- Add 'Voided' to invoice_status enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'Voided' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'invoice_status')
  ) THEN
    ALTER TYPE invoice_status ADD VALUE 'Voided';
  END IF;
END $$;

-- Add unique constraint on debtor_contacts for external_contact_id upsert to work
-- First drop the partial index if exists, then create a proper constraint
DROP INDEX IF EXISTS idx_debtor_contacts_external_id_upsert;

-- Create a unique constraint that matches the onConflict specification
ALTER TABLE debtor_contacts 
ADD CONSTRAINT debtor_contacts_user_debtor_external_unique 
UNIQUE (user_id, debtor_id, external_contact_id);