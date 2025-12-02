-- Convert all SMS workflow steps to email
-- This aligns with the email-only collection workflow strategy
UPDATE collection_workflow_steps
SET channel = 'email'
WHERE channel = 'sms';