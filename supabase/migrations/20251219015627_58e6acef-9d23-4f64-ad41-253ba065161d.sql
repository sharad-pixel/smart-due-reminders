-- Add account-level outreach settings to debtors table
ALTER TABLE public.debtors 
ADD COLUMN IF NOT EXISTS account_outreach_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS outreach_frequency text DEFAULT 'weekly',
ADD COLUMN IF NOT EXISTS outreach_frequency_days integer DEFAULT 7,
ADD COLUMN IF NOT EXISTS next_outreach_date date,
ADD COLUMN IF NOT EXISTS last_outreach_date date,
ADD COLUMN IF NOT EXISTS account_outreach_persona text DEFAULT 'sam';

-- Add comment for documentation
COMMENT ON COLUMN public.debtors.account_outreach_enabled IS 'When true, invoices are excluded from individual AI workflows and outreach is managed at account level';
COMMENT ON COLUMN public.debtors.outreach_frequency IS 'Frequency type: weekly, biweekly, monthly, custom';
COMMENT ON COLUMN public.debtors.outreach_frequency_days IS 'Number of days between outreach when using custom frequency';
COMMENT ON COLUMN public.debtors.next_outreach_date IS 'Next scheduled date for account-level outreach';
COMMENT ON COLUMN public.debtors.last_outreach_date IS 'Date of last account-level outreach';
COMMENT ON COLUMN public.debtors.account_outreach_persona IS 'Persona to use for account-level outreach';