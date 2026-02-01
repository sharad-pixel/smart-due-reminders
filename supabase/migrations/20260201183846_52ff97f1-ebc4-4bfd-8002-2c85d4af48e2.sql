-- Add marketing campaign enhancements to marketing_leads table
ALTER TABLE marketing_leads ADD COLUMN IF NOT EXISTS lead_score integer DEFAULT 0;
ALTER TABLE marketing_leads ADD COLUMN IF NOT EXISTS segment text DEFAULT 'new';
ALTER TABLE marketing_leads ADD COLUMN IF NOT EXISTS industry text;
ALTER TABLE marketing_leads ADD COLUMN IF NOT EXISTS company_size text;
ALTER TABLE marketing_leads ADD COLUMN IF NOT EXISTS last_engaged_at timestamp with time zone;
ALTER TABLE marketing_leads ADD COLUMN IF NOT EXISTS campaign_id uuid;
ALTER TABLE marketing_leads ADD COLUMN IF NOT EXISTS lifecycle_stage text DEFAULT 'lead';
ALTER TABLE marketing_leads ADD COLUMN IF NOT EXISTS notes text;

-- Create marketing_campaigns table for campaign management
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  campaign_type text NOT NULL DEFAULT 'nurture',
  target_segment text,
  target_industry text,
  target_company_size text,
  min_lead_score integer DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  started_at timestamp with time zone,
  ends_at timestamp with time zone,
  total_leads integer DEFAULT 0,
  emails_sent integer DEFAULT 0,
  opens integer DEFAULT 0,
  clicks integer DEFAULT 0,
  conversions integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS on marketing_campaigns
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;

-- Admin-only policy for marketing_campaigns
CREATE POLICY "Admins can manage marketing campaigns"
ON marketing_campaigns FOR ALL
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Create marketing_lead_activities for engagement tracking
CREATE TABLE IF NOT EXISTS marketing_lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES marketing_leads(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  broadcast_id uuid REFERENCES email_broadcasts(id) ON DELETE SET NULL,
  activity_type text NOT NULL,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on marketing_lead_activities
ALTER TABLE marketing_lead_activities ENABLE ROW LEVEL SECURITY;

-- Admin-only policy for lead activities
CREATE POLICY "Admins can manage lead activities"
ON marketing_lead_activities FOR ALL
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Add index for campaign lookups
CREATE INDEX IF NOT EXISTS idx_marketing_leads_campaign ON marketing_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_segment ON marketing_leads(segment);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_score ON marketing_leads(lead_score);
CREATE INDEX IF NOT EXISTS idx_marketing_lead_activities_lead ON marketing_lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_marketing_lead_activities_campaign ON marketing_lead_activities(campaign_id);