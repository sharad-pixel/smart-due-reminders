-- 1. USER ALERTS TABLE
CREATE TABLE IF NOT EXISTS user_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'email_bounced', 'email_invalid', 'email_rejected', 
    'email_complained', 'outreach_paused', 'outreach_resumed',
    'sync_failed', 'payment_received', 'system'
  )),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error', 'success')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  debtor_id UUID REFERENCES debtors(id) ON DELETE SET NULL,
  action_url TEXT,
  action_label TEXT,
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_alerts_user ON user_alerts(user_id, is_read, is_dismissed, created_at DESC);
CREATE INDEX idx_user_alerts_org ON user_alerts(organization_id, created_at DESC);

ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts" ON user_alerts 
  FOR SELECT USING (user_id = auth.uid() OR public.can_access_organization(auth.uid(), organization_id));

CREATE POLICY "Users can update own alerts" ON user_alerts 
  FOR UPDATE USING (user_id = auth.uid() OR public.can_access_organization(auth.uid(), organization_id));

CREATE POLICY "Users can delete own alerts" ON user_alerts 
  FOR DELETE USING (user_id = auth.uid() OR public.can_access_organization(auth.uid(), organization_id));

-- 2. ADD EMAIL STATUS TO DEBTORS
ALTER TABLE debtors
ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS email_status_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_bounce_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_bounce_reason TEXT;

-- 3. TRIGGER FOR AUTO-RESUME WHEN EMAIL FIXED
CREATE OR REPLACE FUNCTION handle_debtor_email_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email 
     AND OLD.email_status IN ('bounced', 'invalid', 'complained') THEN
    
    NEW.email_status := 'unknown';
    NEW.email_bounce_count := 0;
    NEW.last_bounce_reason := NULL;
    NEW.email_status_updated_at := now();
    
    -- Resume outreach for open invoices
    UPDATE invoice_outreach io
    SET is_active = true, paused_at = NULL, updated_at = now()
    FROM invoices i
    WHERE io.invoice_id = i.id
      AND i.debtor_id = NEW.id
      AND i.status = 'Open';
    
    -- Create success alert
    INSERT INTO user_alerts (user_id, organization_id, alert_type, severity, title, message, debtor_id, action_url, action_label)
    VALUES (
      NEW.user_id,
      (SELECT id FROM organizations WHERE owner_user_id = NEW.user_id LIMIT 1),
      'outreach_resumed', 
      'success',
      '✅ Outreach Resumed',
      'Email updated for ' || COALESCE(NEW.company_name, NEW.name, 'account') || '. Outreach will continue automatically.',
      NEW.id,
      '/accounts/' || NEW.id,
      'View Account'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS debtor_email_update_trigger ON debtors;
CREATE TRIGGER debtor_email_update_trigger
  BEFORE UPDATE OF email ON debtors
  FOR EACH ROW
  EXECUTE FUNCTION handle_debtor_email_update();

-- Enable realtime for alerts
ALTER PUBLICATION supabase_realtime ADD TABLE user_alerts;