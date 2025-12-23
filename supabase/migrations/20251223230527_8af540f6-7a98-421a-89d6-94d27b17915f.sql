-- Create collection_campaigns table for AI-driven risk-based campaigns
CREATE TABLE public.collection_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Risk targeting
  target_risk_tier TEXT NOT NULL CHECK (target_risk_tier IN ('Low', 'Medium', 'High', 'Critical', 'All')),
  min_risk_score INTEGER DEFAULT 0,
  max_risk_score INTEGER DEFAULT 100,
  
  -- AI Strategy
  ai_strategy TEXT, -- AI-generated collection strategy
  ai_recommended_tone TEXT, -- friendly, firm, urgent, legal
  ai_recommended_channel TEXT, -- email, sms, phone, multi-channel
  ai_confidence_score NUMERIC, -- How confident AI is in this strategy
  
  -- Campaign settings
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  priority INTEGER DEFAULT 1,
  
  -- Targeting criteria
  min_balance NUMERIC DEFAULT 0,
  max_balance NUMERIC,
  min_days_past_due INTEGER DEFAULT 0,
  max_days_past_due INTEGER,
  
  -- Stats
  total_accounts INTEGER DEFAULT 0,
  total_balance NUMERIC DEFAULT 0,
  accounts_contacted INTEGER DEFAULT 0,
  accounts_collected INTEGER DEFAULT 0,
  amount_collected NUMERIC DEFAULT 0,
  
  -- Timestamps
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.collection_campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own and team campaigns" 
ON public.collection_campaigns 
FOR SELECT 
USING (can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Users can create campaigns for own or team account" 
ON public.collection_campaigns 
FOR INSERT 
WITH CHECK (user_id = get_effective_account_id(auth.uid()));

CREATE POLICY "Users can update own and team campaigns" 
ON public.collection_campaigns 
FOR UPDATE 
USING (can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Users can delete own and team campaigns" 
ON public.collection_campaigns 
FOR DELETE 
USING (can_access_account_data(auth.uid(), user_id));

-- Create campaign_accounts junction table
CREATE TABLE public.campaign_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.collection_campaigns(id) ON DELETE CASCADE,
  debtor_id UUID NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Account snapshot at time of assignment
  risk_score_at_assignment INTEGER,
  balance_at_assignment NUMERIC,
  
  -- Campaign progress for this account
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'contacted', 'responded', 'collected', 'failed', 'excluded')),
  last_action_at TIMESTAMP WITH TIME ZONE,
  amount_collected NUMERIC DEFAULT 0,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(campaign_id, debtor_id)
);

-- Enable RLS
ALTER TABLE public.campaign_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own and team campaign accounts" 
ON public.campaign_accounts 
FOR SELECT 
USING (can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Users can manage campaign accounts" 
ON public.campaign_accounts 
FOR ALL 
USING (can_access_account_data(auth.uid(), user_id));

-- Create index for faster lookups
CREATE INDEX idx_collection_campaigns_user_risk ON public.collection_campaigns(user_id, target_risk_tier);
CREATE INDEX idx_collection_campaigns_status ON public.collection_campaigns(status);
CREATE INDEX idx_campaign_accounts_campaign ON public.campaign_accounts(campaign_id);
CREATE INDEX idx_campaign_accounts_debtor ON public.campaign_accounts(debtor_id);