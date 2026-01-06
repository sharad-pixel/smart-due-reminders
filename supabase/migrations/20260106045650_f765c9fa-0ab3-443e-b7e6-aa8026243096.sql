-- ═══════════════════════════════════════════════════════════════
-- COMPLETE REWRITE: AI OUTREACH WORKFLOW SYSTEM
-- ═══════════════════════════════════════════════════════════════

-- 1. OUTREACH TEMPLATES TABLE (Pre-approved templates per agent)
CREATE TABLE IF NOT EXISTS outreach_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL CHECK (agent_name IN ('Sam', 'James', 'Katy', 'Jimmy', 'Troy', 'Rocco')),
  aging_bucket TEXT NOT NULL CHECK (aging_bucket IN ('dpd_1_30', 'dpd_31_60', 'dpd_61_90', 'dpd_91_120', 'dpd_121_150', 'dpd_150_plus')),
  step_number INTEGER NOT NULL CHECK (step_number IN (1, 2, 3)),
  cadence_day INTEGER NOT NULL CHECK (cadence_day IN (0, 7, 14)),
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, aging_bucket, step_number)
);

-- 2. INVOICE OUTREACH TRACKING TABLE (Tracks outreach per invoice)
CREATE TABLE IF NOT EXISTS invoice_outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  current_bucket TEXT NOT NULL,
  bucket_entered_at DATE NOT NULL,
  step_1_sent_at TIMESTAMPTZ,
  step_2_sent_at TIMESTAMPTZ,
  step_3_sent_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(invoice_id)
);

-- 3. OUTREACH LOG TABLE (Audit trail of all emails sent)
CREATE TABLE IF NOT EXISTS outreach_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  agent_name TEXT NOT NULL,
  aging_bucket TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  cadence_day INTEGER NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced')),
  error_message TEXT,
  invoice_link TEXT
);

-- Enable RLS
ALTER TABLE outreach_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for outreach_templates
CREATE POLICY "Users manage own templates" ON outreach_templates
  FOR ALL USING (user_id = auth.uid());

-- RLS Policies for invoice_outreach
CREATE POLICY "Users manage own outreach" ON invoice_outreach
  FOR ALL USING (user_id = auth.uid());

-- RLS Policies for outreach_log
CREATE POLICY "Users view own logs" ON outreach_log
  FOR ALL USING (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX idx_outreach_templates_user_bucket ON outreach_templates(user_id, aging_bucket);
CREATE INDEX idx_invoice_outreach_invoice ON invoice_outreach(invoice_id);
CREATE INDEX idx_invoice_outreach_active ON invoice_outreach(is_active, bucket_entered_at);
CREATE INDEX idx_invoice_outreach_user ON invoice_outreach(user_id, is_active);
CREATE INDEX idx_outreach_log_invoice ON outreach_log(invoice_id);
CREATE INDEX idx_outreach_log_user_date ON outreach_log(user_id, sent_at);

-- ═══════════════════════════════════════════════════════════════
-- FUNCTION: Create default outreach templates for a user
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION create_default_outreach_templates(p_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Only create if user doesn't have templates
  IF EXISTS (SELECT 1 FROM outreach_templates WHERE user_id = p_user_id LIMIT 1) THEN
    RETURN;
  END IF;

  -- SAM (1-30 days) - Friendly
  INSERT INTO outreach_templates (user_id, agent_name, aging_bucket, step_number, cadence_day, subject_template, body_template)
  VALUES
    (p_user_id, 'Sam', 'dpd_1_30', 1, 0, 
     'Friendly Reminder: Invoice {{invoice_number}} is Past Due',
     'Hi {{debtor_name}},

I hope this message finds you well! I wanted to reach out regarding invoice {{invoice_number}} for {{amount_due}}, which was due on {{due_date}}.

If you''ve already sent payment, please disregard this message. Otherwise, we''d appreciate if you could process this at your earliest convenience.
{{invoice_link}}

Best regards,
Sam'),

    (p_user_id, 'Sam', 'dpd_1_30', 2, 7,
     'Following Up: Invoice {{invoice_number}}',
     'Hi {{debtor_name}},

Just checking in on invoice {{invoice_number}} for {{amount_due}}. It''s now {{days_overdue}} days past the due date of {{due_date}}.

Is there anything I can help with to get this resolved?
{{invoice_link}}

Thanks,
Sam'),

    (p_user_id, 'Sam', 'dpd_1_30', 3, 14,
     'Action Needed: Invoice {{invoice_number}} - 14 Days Overdue',
     'Hi {{debtor_name}},

This is a friendly reminder that invoice {{invoice_number}} for {{amount_due}} is now 14 days past due.

Please let us know if there are any issues preventing payment.
{{invoice_link}}

Best,
Sam');

  -- JAMES (31-60 days) - Professional
  INSERT INTO outreach_templates (user_id, agent_name, aging_bucket, step_number, cadence_day, subject_template, body_template)
  VALUES
    (p_user_id, 'James', 'dpd_31_60', 1, 0,
     'Payment Required: Invoice {{invoice_number}} - 30+ Days Overdue',
     'Dear {{debtor_name}},

I''m writing regarding invoice {{invoice_number}} for {{amount_due}}, which is now over 30 days past due.

Please process payment immediately or contact us to discuss payment arrangements.
{{invoice_link}}

Regards,
James'),

    (p_user_id, 'James', 'dpd_31_60', 2, 7,
     'Second Notice: Invoice {{invoice_number}} Requires Immediate Attention',
     'Dear {{debtor_name}},

This is our second notice regarding invoice {{invoice_number}} for {{amount_due}}. The invoice is now {{days_overdue}} days overdue.

Prompt payment is required to avoid further action.
{{invoice_link}}

Regards,
James'),

    (p_user_id, 'James', 'dpd_31_60', 3, 14,
     'Final Notice Before Escalation: Invoice {{invoice_number}}',
     'Dear {{debtor_name}},

Invoice {{invoice_number}} for {{amount_due}} remains unpaid after multiple notices.

This matter will be escalated if payment is not received within 7 days.
{{invoice_link}}

James');

  -- KATY (61-90 days) - Firm
  INSERT INTO outreach_templates (user_id, agent_name, aging_bucket, step_number, cadence_day, subject_template, body_template)
  VALUES
    (p_user_id, 'Katy', 'dpd_61_90', 1, 0,
     'URGENT: Invoice {{invoice_number}} - 60+ Days Overdue',
     '{{debtor_name}},

Invoice {{invoice_number}} for {{amount_due}} is now seriously overdue at {{days_overdue}} days past due.

Immediate payment is required. Contact us today to resolve this matter.
{{invoice_link}}

Katy'),

    (p_user_id, 'Katy', 'dpd_61_90', 2, 7,
     'URGENT FOLLOW-UP: Invoice {{invoice_number}} - Action Required',
     '{{debtor_name}},

We have not received payment or response regarding invoice {{invoice_number}} for {{amount_due}}.

This account is at risk of being sent to collections. Please respond immediately.
{{invoice_link}}

Katy'),

    (p_user_id, 'Katy', 'dpd_61_90', 3, 14,
     'FINAL WARNING: Invoice {{invoice_number}} - Collections Pending',
     '{{debtor_name}},

This is your final warning. Invoice {{invoice_number}} for {{amount_due}} will be escalated to our collections team if not paid within 7 days.
{{invoice_link}}

Katy');

  -- JIMMY (91-120 days) - Serious
  INSERT INTO outreach_templates (user_id, agent_name, aging_bucket, step_number, cadence_day, subject_template, body_template)
  VALUES
    (p_user_id, 'Jimmy', 'dpd_91_120', 1, 0,
     'SERIOUS DELINQUENCY: Invoice {{invoice_number}} - 90+ Days',
     '{{debtor_name}},

Your account has a serious delinquency. Invoice {{invoice_number}} for {{amount_due}} is {{days_overdue}} days overdue.

Contact us immediately to avoid collections action.
{{invoice_link}}

Jimmy'),

    (p_user_id, 'Jimmy', 'dpd_91_120', 2, 7,
     'COLLECTIONS WARNING: Invoice {{invoice_number}}',
     '{{debtor_name}},

Invoice {{invoice_number}} for {{amount_due}} is being prepared for collections transfer.

This is your opportunity to resolve before external action begins.
{{invoice_link}}

Jimmy'),

    (p_user_id, 'Jimmy', 'dpd_91_120', 3, 14,
     'LAST CHANCE: Invoice {{invoice_number}} - Collections Imminent',
     '{{debtor_name}},

Final notice before collections. Invoice {{invoice_number}} for {{amount_due}} must be paid within 48 hours.
{{invoice_link}}

Jimmy');

  -- TROY (121-150 days) - Final Warning
  INSERT INTO outreach_templates (user_id, agent_name, aging_bucket, step_number, cadence_day, subject_template, body_template)
  VALUES
    (p_user_id, 'Troy', 'dpd_121_150', 1, 0,
     'FINAL DEMAND: Invoice {{invoice_number}} - Legal Action Pending',
     '{{debtor_name}},

This is a formal demand for payment of invoice {{invoice_number}} for {{amount_due}}.

Failure to pay may result in legal action and credit reporting.
{{invoice_link}}

Troy'),

    (p_user_id, 'Troy', 'dpd_121_150', 2, 7,
     'LEGAL NOTICE: Invoice {{invoice_number}} - Immediate Action Required',
     '{{debtor_name}},

Invoice {{invoice_number}} for {{amount_due}} - {{days_overdue}} days overdue.

Legal proceedings are being considered. Respond within 72 hours.
{{invoice_link}}

Troy'),

    (p_user_id, 'Troy', 'dpd_121_150', 3, 14,
     'FINAL LEGAL WARNING: Invoice {{invoice_number}}',
     '{{debtor_name}},

Last opportunity to settle invoice {{invoice_number}} for {{amount_due}} before legal action.
{{invoice_link}}

Troy');

  -- ROCCO (150+ days) - Collections
  INSERT INTO outreach_templates (user_id, agent_name, aging_bucket, step_number, cadence_day, subject_template, body_template)
  VALUES
    (p_user_id, 'Rocco', 'dpd_150_plus', 1, 0,
     'COLLECTIONS: Invoice {{invoice_number}} - Account Delinquent',
     '{{debtor_name}},

Your account is now in collections. Invoice {{invoice_number}} for {{amount_due}} is severely delinquent.

Contact us immediately to discuss settlement options.
{{invoice_link}}

Rocco - Collections'),

    (p_user_id, 'Rocco', 'dpd_150_plus', 2, 7,
     'COLLECTIONS NOTICE: Invoice {{invoice_number}} - Settlement Required',
     '{{debtor_name}},

Collections action is underway for invoice {{invoice_number}} - {{amount_due}}.

A settlement offer may still be available. Contact us today.
{{invoice_link}}

Rocco - Collections'),

    (p_user_id, 'Rocco', 'dpd_150_plus', 3, 14,
     'FINAL COLLECTIONS NOTICE: Invoice {{invoice_number}}',
     '{{debtor_name}},

Final collections notice for invoice {{invoice_number}} - {{amount_due}}.

All available collection remedies will be pursued.
{{invoice_link}}

Rocco - Collections');

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
-- TRIGGER: Stop outreach when invoice is paid/canceled/voided
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_invoice_status_change_outreach()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('Paid', 'Canceled', 'Voided', 'paid', 'canceled', 'voided') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('Paid', 'Canceled', 'Voided', 'paid', 'canceled', 'voided')) THEN
    
    UPDATE invoice_outreach
    SET is_active = false,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE invoice_id = NEW.id;
    
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS invoice_status_outreach_trigger ON invoices;
CREATE TRIGGER invoice_status_outreach_trigger
  AFTER UPDATE OF status ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION handle_invoice_status_change_outreach();

-- ═══════════════════════════════════════════════════════════════
-- TRIGGER: Auto-create templates for new users
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION auto_create_outreach_templates()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_default_outreach_templates(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS create_outreach_templates_on_profile ON profiles;
CREATE TRIGGER create_outreach_templates_on_profile
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_outreach_templates();