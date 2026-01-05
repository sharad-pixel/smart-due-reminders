-- Add integration_source to debtors table (similar to invoices)
ALTER TABLE public.debtors 
ADD COLUMN IF NOT EXISTS integration_source TEXT 
CHECK (integration_source IN ('recouply_manual', 'csv_upload', 'stripe', 'quickbooks', 'xero'));

-- Create a function to generate RAID for accounts that don't have reference_id
CREATE OR REPLACE FUNCTION public.generate_debtor_raid()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference_id IS NULL OR NEW.reference_id = '' THEN
    NEW.reference_id := 'RAID-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate RAID on insert
DROP TRIGGER IF EXISTS generate_debtor_raid_trigger ON public.debtors;
CREATE TRIGGER generate_debtor_raid_trigger
  BEFORE INSERT ON public.debtors
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_debtor_raid();

-- Backfill existing debtors without proper reference_id
UPDATE public.debtors 
SET reference_id = 'RAID-' || UPPER(SUBSTRING(id::text, 1, 8))
WHERE reference_id IS NULL OR reference_id = '';

-- Backfill integration_source for existing data
UPDATE public.debtors 
SET integration_source = 'stripe'
WHERE external_system = 'stripe' AND integration_source IS NULL;

UPDATE public.debtors 
SET integration_source = 'csv_upload'
WHERE external_system IS NULL 
  AND reference_id LIKE 'RCPLY-ACCT-%'
  AND integration_source IS NULL;

UPDATE public.debtors 
SET integration_source = 'recouply_manual'
WHERE integration_source IS NULL;