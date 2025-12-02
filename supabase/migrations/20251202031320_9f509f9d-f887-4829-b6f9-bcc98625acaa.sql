-- Create missing workflow for dpd_31_60 (James - 31-60 Days Past Due)
INSERT INTO collection_workflows (
  name,
  description,
  aging_bucket,
  is_active,
  is_default,
  auto_generate_drafts,
  user_id
) VALUES (
  '31-60 Days Past Due - B2C Friendly',
  'Collection workflow for invoices 31-60 days past due',
  'dpd_31_60',
  true,
  false,
  true,
  'a715d8d4-5a95-459b-b626-8ed0fde5db97'
);

-- Create workflow steps for dpd_31_60
WITH workflow AS (
  SELECT id FROM collection_workflows 
  WHERE aging_bucket = 'dpd_31_60' 
  AND user_id = 'a715d8d4-5a95-459b-b626-8ed0fde5db97'
  AND is_active = true
  LIMIT 1
)
INSERT INTO collection_workflow_steps (
  workflow_id,
  step_order,
  label,
  day_offset,
  channel,
  ai_template_type,
  trigger_type,
  body_template,
  subject_template,
  is_active
) SELECT 
  workflow.id,
  step_order,
  label,
  day_offset,
  channel::channel_type,
  ai_template_type,
  trigger_type,
  body_template,
  subject_template,
  is_active
FROM workflow, (VALUES
  (1, 'Quick Reminder', 3, 'email', 'reminder', 'relative_to_due', 'Friendly reminder about invoice {{invoice_number}}', 'Reminder: Invoice {{invoice_number}} Past Due', true),
  (2, 'Payment Reminder', 7, 'email', 'reminder', 'relative_to_due', 'Second reminder about outstanding invoice {{invoice_number}}', 'Payment Reminder: Invoice {{invoice_number}}', true),
  (3, 'Payment Required', 14, 'email', 'urgent', 'relative_to_due', 'Urgent: Payment required for invoice {{invoice_number}}', 'Action Required: Invoice {{invoice_number}}', true),
  (4, 'Account Action Notice', 21, 'email', 'urgent', 'relative_to_due', 'Important notice regarding your account and invoice {{invoice_number}}', 'Important: Account Notice for Invoice {{invoice_number}}', true),
  (5, 'Final Notice', 30, 'email', 'final', 'relative_to_due', 'Final notice before further action on invoice {{invoice_number}}', 'Final Notice: Invoice {{invoice_number}}', true)
) AS t(step_order, label, day_offset, channel, ai_template_type, trigger_type, body_template, subject_template, is_active);

-- Create missing workflow for dpd_120_plus (Gotti - 120+ Days Past Due)
INSERT INTO collection_workflows (
  name,
  description,
  aging_bucket,
  is_active,
  is_default,
  auto_generate_drafts,
  user_id
) VALUES (
  '120+ Days Past Due - B2B Professional',
  'Collection workflow for invoices 120+ days past due',
  'dpd_120_plus',
  true,
  false,
  true,
  'a715d8d4-5a95-459b-b626-8ed0fde5db97'
);

-- Create workflow steps for dpd_120_plus
WITH workflow AS (
  SELECT id FROM collection_workflows 
  WHERE aging_bucket = 'dpd_120_plus' 
  AND user_id = 'a715d8d4-5a95-459b-b626-8ed0fde5db97'
  AND is_active = true
  LIMIT 1
)
INSERT INTO collection_workflow_steps (
  workflow_id,
  step_order,
  label,
  day_offset,
  channel,
  ai_template_type,
  trigger_type,
  body_template,
  subject_template,
  is_active
) SELECT 
  workflow.id,
  step_order,
  label,
  day_offset,
  channel::channel_type,
  ai_template_type,
  trigger_type,
  body_template,
  subject_template,
  is_active
FROM workflow, (VALUES
  (1, 'Immediate Action Required', 3, 'email', 'final', 'relative_to_due', 'Immediate action required for severely past due invoice {{invoice_number}}', 'URGENT: Immediate Action Required - Invoice {{invoice_number}}', true),
  (2, 'Pre-Collection Notice', 7, 'email', 'final', 'relative_to_due', 'Pre-collection notice for invoice {{invoice_number}}', 'Pre-Collection Notice: Invoice {{invoice_number}}', true),
  (3, 'Final Warning', 14, 'email', 'final', 'relative_to_due', 'Final warning before collection proceedings for invoice {{invoice_number}}', 'FINAL WARNING: Invoice {{invoice_number}}', true),
  (4, 'Collection Intent', 21, 'email', 'final', 'relative_to_due', 'Notice of intent to proceed with collection action on invoice {{invoice_number}}', 'Collection Action Notice: Invoice {{invoice_number}}', true),
  (5, 'Last Chance', 30, 'email', 'final', 'relative_to_due', 'Last opportunity to resolve before external collection on invoice {{invoice_number}}', 'LAST CHANCE: Invoice {{invoice_number}}', true)
) AS t(step_order, label, day_offset, channel, ai_template_type, trigger_type, body_template, subject_template, is_active);