-- Email Activity Log for tracking all email sends
CREATE TABLE IF NOT EXISTS email_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  debtor_id UUID REFERENCES debtors(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  agent_name TEXT,
  template_type TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed')),
  failure_reason TEXT,
  resend_email_id TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  metadata JSONB
);

CREATE INDEX idx_email_activity_user ON email_activity_log(user_id, sent_at DESC);
CREATE INDEX idx_email_activity_org ON email_activity_log(organization_id, sent_at DESC);
CREATE INDEX idx_email_activity_status ON email_activity_log(status, sent_at DESC);
CREATE INDEX idx_email_activity_resend ON email_activity_log(resend_email_id);

ALTER TABLE email_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own email activity" ON email_activity_log
  FOR SELECT USING (
    user_id = auth.uid() OR 
    organization_id = public.get_user_organization_id(auth.uid())
  );

CREATE POLICY "Users insert own email activity" ON email_activity_log
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR 
    organization_id = public.get_user_organization_id(auth.uid())
  );

-- Add organization_id to user_alerts if not exists
ALTER TABLE user_alerts 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Update RLS policy for user_alerts to support org access
DROP POLICY IF EXISTS "Users manage own alerts" ON user_alerts;
CREATE POLICY "Users manage own alerts" ON user_alerts 
  FOR ALL USING (
    user_id = auth.uid() OR 
    organization_id = public.get_user_organization_id(auth.uid())
  );