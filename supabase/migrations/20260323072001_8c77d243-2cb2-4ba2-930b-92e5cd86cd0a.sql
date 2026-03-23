-- Enable auto_generate_drafts for all active workflows that currently have it off
UPDATE collection_workflows
SET auto_generate_drafts = true
WHERE is_active = true
AND auto_generate_drafts = false;