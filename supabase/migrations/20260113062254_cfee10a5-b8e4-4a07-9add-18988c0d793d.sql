-- Add account outreach tone field to debtors table
-- This allows users to control the tone intensity for account-level outreach
ALTER TABLE public.debtors 
ADD COLUMN IF NOT EXISTS account_outreach_tone INTEGER DEFAULT 3;

-- Add comment explaining the field
COMMENT ON COLUMN public.debtors.account_outreach_tone IS 'Tone intensity for account-level outreach: 1=Much Softer, 2=Softer, 3=Standard, 4=Firmer, 5=Much Firmer';