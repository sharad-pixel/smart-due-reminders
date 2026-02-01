-- Add campaign_id column to email_broadcasts for campaign-linked outreach
ALTER TABLE public.email_broadcasts 
ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL;

-- Create index for faster campaign-broadcast lookups
CREATE INDEX IF NOT EXISTS idx_email_broadcasts_campaign_id ON public.email_broadcasts(campaign_id);

-- Add a comment for clarity
COMMENT ON COLUMN public.email_broadcasts.campaign_id IS 'Links this broadcast/draft to a specific marketing campaign';