-- Clear all draft templates
DELETE FROM draft_templates;

-- Update Rocco persona to focus on compliance and legal procedures
UPDATE ai_agent_personas
SET tone_guidelines = 'Rocco communicates with authority and compliance focus. He references credit reporting, delinquency procedures, and potential legal action as consequences of non-payment. His tone is firm and professional, emphasizing the seriousness of the situation while remaining respectful and compliant. He makes it clear that escalation to legal channels or credit agencies is a possibility if payment is not received promptly. Always writes as the customer''s business, never as Recouply.ai or a third-party collection agency.',
    persona_summary = 'Compliance-focused collections specialist who emphasizes credit reporting, delinquency procedures, and potential legal escalation for severely overdue accounts.'
WHERE name = 'Rocco';

-- Update workflow steps to 3-step cadence (days 3, 7, 14)
-- Delete existing steps for all workflows
DELETE FROM collection_workflow_steps;

-- Recreate 3-step workflow structure for each aging bucket
-- We'll insert 3 steps per workflow with day offsets of 3, 7, and 14
INSERT INTO collection_workflow_steps (workflow_id, step_order, day_offset, label, channel, trigger_type, ai_template_type, body_template, is_active, requires_review)
SELECT 
  w.id as workflow_id,
  1 as step_order,
  3 as day_offset,
  'Initial Reminder' as label,
  'email'::channel_type as channel,
  'relative_to_due' as trigger_type,
  'friendly_reminder' as ai_template_type,
  'Generate a polite reminder about the overdue invoice.' as body_template,
  true as is_active,
  true as requires_review
FROM collection_workflows w
WHERE w.is_active = true

UNION ALL

SELECT 
  w.id as workflow_id,
  2 as step_order,
  7 as day_offset,
  'Follow-Up Notice' as label,
  'email'::channel_type as channel,
  'relative_to_due' as trigger_type,
  'firm_reminder' as ai_template_type,
  'Generate a firm follow-up notice emphasizing urgency.' as body_template,
  true as is_active,
  true as requires_review
FROM collection_workflows w
WHERE w.is_active = true

UNION ALL

SELECT 
  w.id as workflow_id,
  3 as step_order,
  14 as day_offset,
  'Final Notice' as label,
  'email'::channel_type as channel,
  'relative_to_due' as trigger_type,
  'urgent_notice' as ai_template_type,
  'Generate a final notice with strong language and clear consequences.' as body_template,
  true as is_active,
  true as requires_review
FROM collection_workflows w
WHERE w.is_active = true;