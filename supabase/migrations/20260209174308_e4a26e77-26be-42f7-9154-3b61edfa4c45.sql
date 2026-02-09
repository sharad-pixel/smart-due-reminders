
-- Add scheduling columns to integration_sync_settings
ALTER TABLE integration_sync_settings
  ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sync_time TEXT DEFAULT '06:00',
  ADD COLUMN IF NOT EXISTS sync_timezone TEXT DEFAULT 'America/Los_Angeles',
  ADD COLUMN IF NOT EXISTS last_auto_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_sync_due_at TIMESTAMPTZ;

-- Create index for efficient cron queries
CREATE INDEX IF NOT EXISTS idx_integration_sync_next_due 
  ON integration_sync_settings (next_sync_due_at) 
  WHERE auto_sync_enabled = true;
