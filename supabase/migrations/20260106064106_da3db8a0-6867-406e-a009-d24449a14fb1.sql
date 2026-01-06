-- Update outreach_log to support more email statuses from Resend
ALTER TABLE outreach_log 
DROP CONSTRAINT IF EXISTS outreach_log_status_check;

ALTER TABLE outreach_log 
ADD CONSTRAINT outreach_log_status_check 
CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed'));

-- Add columns to track Resend events
ALTER TABLE outreach_log 
ADD COLUMN IF NOT EXISTS resend_id TEXT,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bounce_type TEXT;

-- Index for looking up by resend_id
CREATE INDEX IF NOT EXISTS idx_outreach_log_resend_id ON outreach_log(resend_id);