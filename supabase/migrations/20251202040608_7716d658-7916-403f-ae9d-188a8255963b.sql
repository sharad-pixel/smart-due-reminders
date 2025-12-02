-- Create global workflow for dpd_91_120 bucket (Troy) if it doesn't exist
INSERT INTO collection_workflows (name, aging_bucket, description, is_active, is_default, auto_generate_drafts, user_id)
SELECT 
  'Troy Collection - 91-120 Days',
  'dpd_91_120',
  '3-step collection workflow for 91-120 day overdue invoices',
  true,
  true,
  false,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM collection_workflows WHERE aging_bucket = 'dpd_91_120' AND user_id IS NULL
);

-- Create workflow steps for dpd_91_120 bucket (Troy)
DO $$
DECLARE
  v_workflow_id UUID;
BEGIN
  SELECT id INTO v_workflow_id 
  FROM collection_workflows 
  WHERE aging_bucket = 'dpd_91_120' AND user_id IS NULL
  LIMIT 1;
  
  IF v_workflow_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM collection_workflow_steps WHERE workflow_id = v_workflow_id
  ) THEN
    INSERT INTO collection_workflow_steps (workflow_id, step_order, day_offset, label, channel, trigger_type, ai_template_type, body_template, subject_template, is_active)
    VALUES
      (v_workflow_id, 1, 3, 'Initial Reminder', 'email'::channel_type, 'relative_to_due', 'friendly_reminder', 'Template placeholder', 'Payment Reminder', true),
      (v_workflow_id, 2, 7, 'Follow-Up Notice', 'email'::channel_type, 'relative_to_due', 'urgent_notice', 'Template placeholder', 'Urgent: Payment Required', true),
      (v_workflow_id, 3, 14, 'Final Notice', 'email'::channel_type, 'relative_to_due', 'final_demand', 'Template placeholder', 'Final Notice: Immediate Action Required', true);
  END IF;
END $$;