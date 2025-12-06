-- Add industry field to debtors table
ALTER TABLE public.debtors
ADD COLUMN IF NOT EXISTS industry TEXT;

COMMENT ON COLUMN public.debtors.industry IS 'Industry classification for the account';

-- Add reference_id (RPID) to payments table with auto-generation
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS reference_id TEXT;

COMMENT ON COLUMN public.payments.reference_id IS 'Recouply Payment ID (RPID) - auto-generated unique identifier';

-- Create function to auto-generate payment reference_id
CREATE OR REPLACE FUNCTION public.generate_payment_reference_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference_id IS NULL THEN
    NEW.reference_id := 'RCPLY-PAY-' || SUBSTRING(NEW.id::text FROM 1 FOR 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for auto-generating payment reference_id
DROP TRIGGER IF EXISTS set_payment_reference_id ON public.payments;
CREATE TRIGGER set_payment_reference_id
  BEFORE INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_payment_reference_id();

-- Update existing payments without reference_id
UPDATE public.payments 
SET reference_id = 'RCPLY-PAY-' || SUBSTRING(id::text FROM 1 FOR 8)
WHERE reference_id IS NULL;

-- Update grouping check constraint to include 'account'
ALTER TABLE public.data_center_field_definitions
DROP CONSTRAINT IF EXISTS data_center_field_definitions_grouping_check;

ALTER TABLE public.data_center_field_definitions
ADD CONSTRAINT data_center_field_definitions_grouping_check 
CHECK (grouping IN ('customer', 'invoice', 'payment', 'meta', 'account'));

-- Insert account-related field definitions
INSERT INTO public.data_center_field_definitions (key, label, data_type, grouping, required_for_recouply, required_for_roundtrip, description)
VALUES 
  ('recouply_account_id', 'Recouply Account ID (RAID)', 'string', 'account', true, true, 'Unique Recouply identifier for the account (maps to debtor.reference_id)'),
  ('external_customer_id', 'External Customer ID', 'string', 'account', false, true, 'Customer ID from external accounting system'),
  ('crm_account_id_external', 'CRM Account ID', 'string', 'account', false, false, 'Account ID from CRM system'),
  ('account_name', 'Account Name', 'string', 'account', false, false, 'Business or company name'),
  ('account_type', 'Account Type', 'string', 'account', false, false, 'B2B or B2C classification'),
  ('industry', 'Industry', 'string', 'account', false, false, 'Industry classification for the account')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description;

-- Update comments for ID reference clarity
COMMENT ON COLUMN public.debtors.reference_id IS 'Recouply Account ID (RAID) - auto-generated unique identifier for the account';
COMMENT ON COLUMN public.invoices.reference_id IS 'Recouply Invoice ID (RIID) - auto-generated unique identifier for the invoice';