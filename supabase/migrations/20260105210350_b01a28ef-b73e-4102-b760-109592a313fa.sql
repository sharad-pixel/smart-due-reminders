-- ═══════════════════════════════════════════════════════════════
-- DUAL CUSTOMER ID SYSTEM
-- ═══════════════════════════════════════════════════════════════

-- 1. Add new columns to debtors table with expanded check constraint
ALTER TABLE debtors
ADD COLUMN IF NOT EXISTS recouply_customer_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS external_customer_source TEXT 
  CHECK (external_customer_source IN ('stripe', 'quickbooks', 'xero', 'netsuite', 'csv', 'csv_upload', 'manual', 'recouply_manual')),
ADD COLUMN IF NOT EXISTS external_customer_url TEXT;

-- 2. Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_debtors_recouply_customer_id ON debtors(recouply_customer_id);
CREATE INDEX IF NOT EXISTS idx_debtors_external_customer_lookup ON debtors(external_customer_id, external_customer_source);

-- 3. Create sequence for Recouply Customer ID
CREATE SEQUENCE IF NOT EXISTS recouply_customer_id_seq START 1000;

-- 4. Create function to auto-generate Recouply ID
CREATE OR REPLACE FUNCTION generate_recouply_customer_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.recouply_customer_id IS NULL THEN
    NEW.recouply_customer_id := 'RCP-' || LPAD(nextval('recouply_customer_id_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- 5. Drop existing trigger if any and create new one
DROP TRIGGER IF EXISTS set_recouply_customer_id ON debtors;
CREATE TRIGGER set_recouply_customer_id
  BEFORE INSERT ON debtors
  FOR EACH ROW
  EXECUTE FUNCTION generate_recouply_customer_id();

-- 6. Backfill existing debtors with Recouply IDs using a DO block
DO $$
DECLARE
  r RECORD;
  counter INTEGER := 0;
BEGIN
  FOR r IN 
    SELECT id FROM debtors 
    WHERE recouply_customer_id IS NULL 
    ORDER BY created_at
  LOOP
    UPDATE debtors 
    SET recouply_customer_id = 'RCP-' || LPAD((1000 + counter)::TEXT, 6, '0')
    WHERE id = r.id;
    counter := counter + 1;
  END LOOP;
  
  -- Update sequence to continue after backfilled IDs
  IF counter > 0 THEN
    PERFORM setval('recouply_customer_id_seq', 1000 + counter);
  END IF;
END $$;

-- 7. Set external_customer_source from integration_source for all
UPDATE debtors
SET external_customer_source = integration_source
WHERE external_customer_source IS NULL
  AND integration_source IS NOT NULL;

-- 8. Set external_customer_url for Stripe customers
UPDATE debtors
SET external_customer_url = 'https://dashboard.stripe.com/customers/' || external_customer_id
WHERE external_customer_id IS NOT NULL
  AND external_customer_id LIKE 'cus_%'
  AND external_customer_url IS NULL;