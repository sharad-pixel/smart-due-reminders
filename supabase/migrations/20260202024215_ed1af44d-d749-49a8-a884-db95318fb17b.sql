-- Create campaign outreach emails table for the 3-step workflow (Day 0, Day 3, Day 7)
CREATE TABLE public.campaign_outreach_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL CHECK (step_number IN (0, 1, 2)),  -- 0=Day0, 1=Day3, 2=Day7
  day_offset INTEGER NOT NULL DEFAULT 0,  -- Day offset from assignment
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'active')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(campaign_id, step_number)
);

-- Create lead campaign tracking table to track each lead's progress through the workflow
CREATE TABLE public.lead_campaign_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.marketing_leads(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  current_step INTEGER NOT NULL DEFAULT 0,
  step_0_sent_at TIMESTAMP WITH TIME ZONE,
  step_1_sent_at TIMESTAMP WITH TIME ZONE,
  step_2_sent_at TIMESTAMP WITH TIME ZONE,
  next_send_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'unsubscribed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, campaign_id)
);

-- Add pricing_tier column to marketing_campaigns for tier-based campaigns
ALTER TABLE public.marketing_campaigns 
ADD COLUMN IF NOT EXISTS pricing_tier TEXT CHECK (pricing_tier IN ('solo_pro', 'starter', 'growth', 'professional'));

-- Enable RLS
ALTER TABLE public.campaign_outreach_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_campaign_progress ENABLE ROW LEVEL SECURITY;

-- RLS policies for campaign_outreach_emails (admin only via service key)
CREATE POLICY "Admins can manage campaign emails"
  ON public.campaign_outreach_emails
  FOR ALL
  USING (true);

-- RLS policies for lead_campaign_progress  
CREATE POLICY "Admins can manage lead progress"
  ON public.lead_campaign_progress
  FOR ALL
  USING (true);

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_campaign_email_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers
CREATE TRIGGER update_campaign_outreach_emails_updated_at
  BEFORE UPDATE ON public.campaign_outreach_emails
  FOR EACH ROW
  EXECUTE FUNCTION public.update_campaign_email_updated_at();

CREATE TRIGGER update_lead_campaign_progress_updated_at
  BEFORE UPDATE ON public.lead_campaign_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_campaign_email_updated_at();

-- Create index for efficient queries
CREATE INDEX idx_campaign_outreach_campaign ON public.campaign_outreach_emails(campaign_id);
CREATE INDEX idx_lead_progress_campaign ON public.lead_campaign_progress(campaign_id);
CREATE INDEX idx_lead_progress_lead ON public.lead_campaign_progress(lead_id);
CREATE INDEX idx_lead_progress_next_send ON public.lead_campaign_progress(next_send_at) WHERE status = 'active';
CREATE INDEX idx_campaigns_pricing_tier ON public.marketing_campaigns(pricing_tier);