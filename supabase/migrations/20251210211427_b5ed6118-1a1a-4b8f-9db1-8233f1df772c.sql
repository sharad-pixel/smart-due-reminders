-- Create email_templates table for platform-wide email template management
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key TEXT NOT NULL UNIQUE,
  template_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'transactional',
  subject_template TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create index for faster lookups
CREATE INDEX idx_email_templates_key ON public.email_templates(template_key);
CREATE INDEX idx_email_templates_category ON public.email_templates(category);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Only platform admins can view templates
CREATE POLICY "Platform admins can view email templates"
ON public.email_templates
FOR SELECT
USING (public.is_recouply_admin(auth.uid()));

-- Only platform admins can insert templates
CREATE POLICY "Platform admins can insert email templates"
ON public.email_templates
FOR INSERT
WITH CHECK (public.is_recouply_admin(auth.uid()));

-- Only platform admins can update templates
CREATE POLICY "Platform admins can update email templates"
ON public.email_templates
FOR UPDATE
USING (public.is_recouply_admin(auth.uid()));

-- Only platform admins can delete templates
CREATE POLICY "Platform admins can delete email templates"
ON public.email_templates
FOR DELETE
USING (public.is_recouply_admin(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates for all platform email types
INSERT INTO public.email_templates (template_key, template_name, category, subject_template, body_html, body_text, variables, description) VALUES
-- Transactional
('welcome_email', 'Welcome Email', 'transactional', 'Welcome to Recouply.ai, {{user_name}}!', '<h1>Welcome to Recouply.ai!</h1><p>Hi {{user_name}},</p><p>Thank you for joining Recouply.ai. We''re excited to help you collect your money intelligently.</p><p>Get started by:</p><ul><li>Uploading your first accounts</li><li>Setting up your branding</li><li>Configuring your AI workflows</li></ul><p>Best regards,<br>The Recouply.ai Team</p>', 'Welcome to Recouply.ai!\n\nHi {{user_name}},\n\nThank you for joining. Get started by uploading your accounts.\n\nBest regards,\nThe Recouply.ai Team', '["user_name", "user_email"]', 'Sent when a new user signs up'),

('password_reset', 'Password Reset', 'transactional', 'Reset Your Recouply.ai Password', '<h1>Password Reset Request</h1><p>Hi {{user_name}},</p><p>Click the link below to reset your password:</p><p><a href="{{reset_link}}">Reset Password</a></p><p>If you didn''t request this, please ignore this email.</p>', 'Password Reset Request\n\nHi {{user_name}},\n\nClick here to reset: {{reset_link}}\n\nIf you didn''t request this, ignore this email.', '["user_name", "reset_link"]', 'Sent when user requests password reset'),

-- Notifications
('task_assignment', 'Task Assignment', 'notification', 'New Task Assigned: {{task_summary}}', '<h1>New Task Assigned</h1><p>Hi {{assignee_name}},</p><p>You have been assigned a new collection task:</p><div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:16px 0;"><strong>{{task_summary}}</strong><br>Account: {{account_name}}<br>Priority: {{priority}}<br>Due: {{due_date}}</div><p><a href="{{task_link}}">View Task</a></p>', 'New Task Assigned\n\nHi {{assignee_name}},\n\nTask: {{task_summary}}\nAccount: {{account_name}}\nPriority: {{priority}}\n\nView: {{task_link}}', '["assignee_name", "task_summary", "account_name", "priority", "due_date", "task_link"]', 'Sent when a task is assigned to a team member'),

('daily_digest', 'Daily Digest', 'notification', 'Your Daily Collections Health Digest - {{digest_date}}', '<h1>Daily Collections Health Digest</h1><p>Hi {{user_name}},</p><h2>Health Score: {{health_score}}/100 ({{health_label}})</h2><h3>AR Summary</h3><ul><li>Total Outstanding: ${{total_ar}}</li><li>Current: ${{ar_current}}</li><li>1-30 Days: ${{ar_1_30}}</li><li>31-60 Days: ${{ar_31_60}}</li><li>61-90 Days: ${{ar_61_90}}</li><li>90+ Days: ${{ar_90_plus}}</li></ul><h3>Tasks</h3><p>Open: {{open_tasks}} | Overdue: {{overdue_tasks}}</p><p><a href="{{dashboard_link}}">View Dashboard</a></p>', 'Daily Digest - {{digest_date}}\n\nHealth Score: {{health_score}}/100\nTotal AR: ${{total_ar}}\nOpen Tasks: {{open_tasks}}', '["user_name", "digest_date", "health_score", "health_label", "total_ar", "ar_current", "ar_1_30", "ar_31_60", "ar_61_90", "ar_90_plus", "open_tasks", "overdue_tasks", "dashboard_link"]', 'Daily summary of collections health'),

('team_invite', 'Team Invitation', 'notification', '{{inviter_name}} invited you to join {{company_name}} on Recouply.ai', '<h1>You''re Invited!</h1><p>Hi,</p><p>{{inviter_name}} has invited you to join <strong>{{company_name}}</strong> on Recouply.ai as a {{role}}.</p><p><a href="{{invite_link}}" style="background:#1e3a5f;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">Accept Invitation</a></p><p>This invitation expires on {{expires_at}}.</p>', 'You''re invited to join {{company_name}} on Recouply.ai!\n\nAccept: {{invite_link}}\n\nExpires: {{expires_at}}', '["inviter_name", "company_name", "role", "invite_link", "expires_at"]', 'Sent when inviting team members'),

-- Collection emails
('collection_reminder', 'Collection Reminder', 'collection', 'Reminder: Invoice {{invoice_number}} - ${{amount}} Outstanding', '<p>Dear {{contact_name}},</p><p>This is a friendly reminder that invoice <strong>{{invoice_number}}</strong> for <strong>${{amount}}</strong> is currently outstanding.</p><p><strong>Invoice Details:</strong></p><ul><li>Invoice Number: {{invoice_number}}</li><li>Amount Due: ${{amount}}</li><li>Due Date: {{due_date}}</li><li>Days Past Due: {{days_past_due}}</li></ul><p>Please arrange payment at your earliest convenience.</p><p>If you have any questions, please don''t hesitate to reach out.</p>', 'Dear {{contact_name}},\n\nInvoice {{invoice_number}} for ${{amount}} is outstanding.\n\nDue Date: {{due_date}}\nDays Past Due: {{days_past_due}}\n\nPlease arrange payment.', '["contact_name", "invoice_number", "amount", "due_date", "days_past_due", "company_name"]', 'Standard collection reminder template'),

('payment_confirmation', 'Payment Confirmation', 'collection', 'Payment Received - Invoice {{invoice_number}}', '<h1>Payment Received</h1><p>Dear {{contact_name}},</p><p>Thank you! We have received your payment of <strong>${{amount}}</strong> for invoice <strong>{{invoice_number}}</strong>.</p><p><strong>Payment Details:</strong></p><ul><li>Amount: ${{amount}}</li><li>Date: {{payment_date}}</li><li>Reference: {{payment_reference}}</li></ul><p>Thank you for your business!</p>', 'Payment Received\n\nThank you for your payment of ${{amount}} for invoice {{invoice_number}}.\n\nPayment Date: {{payment_date}}', '["contact_name", "invoice_number", "amount", "payment_date", "payment_reference"]', 'Sent when payment is received'),

-- Marketing
('product_update', 'Product Update', 'marketing', 'What''s New at Recouply.ai - {{month}} {{year}}', '<h1>What''s New at Recouply.ai</h1><p>Hi {{user_name}},</p><p>Here are the latest updates and features:</p>{{update_content}}<p><a href="{{cta_link}}">{{cta_text}}</a></p><p>Questions? Reply to this email or contact support@recouply.ai</p>', 'What''s New at Recouply.ai\n\nHi {{user_name}},\n\n{{update_content_text}}\n\nLearn more: {{cta_link}}', '["user_name", "month", "year", "update_content", "update_content_text", "cta_link", "cta_text"]', 'Monthly product updates and announcements'),

('feature_announcement', 'Feature Announcement', 'marketing', 'New Feature: {{feature_name}}', '<h1>Introducing {{feature_name}}</h1><p>Hi {{user_name}},</p><p>{{feature_description}}</p><p><a href="{{feature_link}}" style="background:#1e3a5f;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">Try It Now</a></p>', 'New Feature: {{feature_name}}\n\nHi {{user_name}},\n\n{{feature_description}}\n\nTry it: {{feature_link}}', '["user_name", "feature_name", "feature_description", "feature_link"]', 'Announce new features to users'),

-- Admin notifications
('admin_alert', 'Admin Alert', 'admin', '[Admin] {{alert_type}}: {{alert_subject}}', '<h1>Admin Alert</h1><p><strong>Type:</strong> {{alert_type}}</p><p><strong>Details:</strong></p>{{alert_details}}<p><strong>Timestamp:</strong> {{timestamp}}</p>', 'Admin Alert\n\nType: {{alert_type}}\nDetails: {{alert_details}}\nTime: {{timestamp}}', '["alert_type", "alert_subject", "alert_details", "timestamp"]', 'Internal admin notifications');

-- Create email_broadcasts table for sending bulk emails
CREATE TABLE public.email_broadcasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.email_templates(id),
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  audience TEXT NOT NULL DEFAULT 'all_active',
  audience_filter JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.email_broadcasts ENABLE ROW LEVEL SECURITY;

-- Only platform admins can manage broadcasts
CREATE POLICY "Platform admins can manage broadcasts"
ON public.email_broadcasts
FOR ALL
USING (public.is_recouply_admin(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_email_broadcasts_updated_at
  BEFORE UPDATE ON public.email_broadcasts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();