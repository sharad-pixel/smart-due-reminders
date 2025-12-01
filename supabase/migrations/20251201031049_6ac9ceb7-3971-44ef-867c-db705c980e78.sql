-- Add auto_generate_drafts column to collection_workflows
ALTER TABLE collection_workflows 
ADD COLUMN IF NOT EXISTS auto_generate_drafts BOOLEAN DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN collection_workflows.auto_generate_drafts IS 'When enabled, automatically generates drafts for all invoices in this aging bucket that need outreach';