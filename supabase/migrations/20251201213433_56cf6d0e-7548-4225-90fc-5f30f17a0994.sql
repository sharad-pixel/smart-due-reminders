-- Add sent_at column to ai_drafts table to track when approved drafts are automatically sent
ALTER TABLE ai_drafts
ADD COLUMN sent_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient querying of unsent approved drafts
CREATE INDEX idx_ai_drafts_approved_unsent ON ai_drafts(status, sent_at) 
WHERE status = 'approved' AND sent_at IS NULL;