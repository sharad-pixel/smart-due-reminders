-- First, drop the existing check constraint
ALTER TABLE collection_workflows DROP CONSTRAINT IF EXISTS collection_workflows_aging_bucket_check;

-- Update existing dpd_120_plus workflows to dpd_121_150
UPDATE collection_workflows 
SET aging_bucket = 'dpd_121_150' 
WHERE aging_bucket = 'dpd_120_plus';

-- Update existing dpd_121_plus workflows to dpd_121_150 (if any)
UPDATE collection_workflows 
SET aging_bucket = 'dpd_121_150' 
WHERE aging_bucket = 'dpd_121_plus';

-- Now add the updated check constraint with new bucket values (after data is updated)
ALTER TABLE collection_workflows 
ADD CONSTRAINT collection_workflows_aging_bucket_check 
CHECK (aging_bucket IN ('current', 'dpd_1_30', 'dpd_31_60', 'dpd_61_90', 'dpd_91_120', 'dpd_121_150', 'dpd_150_plus'));

-- Update the aging bucket calculation function to support more granular buckets
CREATE OR REPLACE FUNCTION public.calculate_aging_bucket(due_date date, payment_date date DEFAULT NULL::date)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  days_past_due INTEGER;
BEGIN
  IF payment_date IS NOT NULL THEN
    RETURN 'paid';
  END IF;
  
  days_past_due := CURRENT_DATE - due_date;
  
  IF days_past_due < 0 THEN
    RETURN 'current';
  ELSIF days_past_due <= 30 THEN
    RETURN 'dpd_1_30';
  ELSIF days_past_due <= 60 THEN
    RETURN 'dpd_31_60';
  ELSIF days_past_due <= 90 THEN
    RETURN 'dpd_61_90';
  ELSIF days_past_due <= 120 THEN
    RETURN 'dpd_91_120';
  ELSIF days_past_due <= 150 THEN
    RETURN 'dpd_121_150';
  ELSE
    RETURN 'dpd_150_plus';
  END IF;
END;
$function$;

-- Update invoices to use new bucket names
UPDATE invoices 
SET aging_bucket = 'dpd_121_150' 
WHERE aging_bucket IN ('dpd_120_plus', 'dpd_121_plus');

-- Update draft_templates to use new bucket names
UPDATE draft_templates
SET aging_bucket = 'dpd_121_150' 
WHERE aging_bucket IN ('dpd_120_plus', 'dpd_121_plus');

-- Update Gotti persona to have correct bucket range
UPDATE ai_agent_personas
SET bucket_max = 150
WHERE name = 'Gotti' AND bucket_min = 121;

-- Update Rocco persona to have correct bucket range
UPDATE ai_agent_personas
SET bucket_min = 151
WHERE name = 'Rocco';

-- Create workflows for dpd_121_150 bucket (Gotti) if they don't exist
INSERT INTO collection_workflows (name, aging_bucket, description, is_active, is_default, auto_generate_drafts, user_id)
SELECT 
  'Gotti Collection - 121-150 Days',
  'dpd_121_150',
  '3-step collection workflow for 121-150 day overdue invoices',
  true,
  true,
  false,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM collection_workflows WHERE aging_bucket = 'dpd_121_150' AND user_id IS NULL AND name = 'Gotti Collection - 121-150 Days'
);

-- Create workflows for dpd_150_plus bucket (Rocco) if they don't exist
INSERT INTO collection_workflows (name, aging_bucket, description, is_active, is_default, auto_generate_drafts, user_id)
SELECT 
  'Rocco Collection - 150+ Days',
  'dpd_150_plus',
  '3-step final internal collection workflow for 150+ day overdue invoices',
  true,
  true,
  false,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM collection_workflows WHERE aging_bucket = 'dpd_150_plus' AND user_id IS NULL
);

-- Create workflow steps for dpd_121_150 bucket (Gotti)
DO $$
DECLARE
  v_workflow_id UUID;
BEGIN
  SELECT id INTO v_workflow_id 
  FROM collection_workflows 
  WHERE aging_bucket = 'dpd_121_150' AND user_id IS NULL
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

-- Create workflow steps for dpd_150_plus bucket (Rocco)
DO $$
DECLARE
  v_workflow_id UUID;
BEGIN
  SELECT id INTO v_workflow_id 
  FROM collection_workflows 
  WHERE aging_bucket = 'dpd_150_plus' AND user_id IS NULL
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