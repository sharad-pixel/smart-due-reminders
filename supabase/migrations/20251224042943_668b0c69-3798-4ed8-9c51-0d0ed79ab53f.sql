-- Add outreach_type field to debtors to clearly allocate accounts to either campaign or workflow outreach
ALTER TABLE public.debtors 
ADD COLUMN IF NOT EXISTS outreach_type TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS assigned_campaign_id UUID REFERENCES public.collection_campaigns(id) ON DELETE SET NULL;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_debtors_outreach_type ON public.debtors(outreach_type);
CREATE INDEX IF NOT EXISTS idx_debtors_assigned_campaign_id ON public.debtors(assigned_campaign_id);

-- Add a comment explaining the field
COMMENT ON COLUMN public.debtors.outreach_type IS 'Tracks how the account is managed: "campaign" for campaign-based outreach, "workflow" for automated workflow outreach, NULL for unassigned';
COMMENT ON COLUMN public.debtors.assigned_campaign_id IS 'The campaign this account is assigned to (if outreach_type = campaign)';