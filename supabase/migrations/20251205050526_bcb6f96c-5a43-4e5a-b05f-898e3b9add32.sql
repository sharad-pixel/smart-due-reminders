-- Add archived_at timestamp for tracking 30-day deletion countdown
ALTER TABLE data_center_uploads 
ADD COLUMN IF NOT EXISTS archived_at timestamptz,
ADD COLUMN IF NOT EXISTS deletion_warning_sent_at timestamptz;

-- Create index for efficient queries on archived uploads
CREATE INDEX IF NOT EXISTS idx_data_center_uploads_archived_at 
ON data_center_uploads(archived_at) WHERE archived_at IS NOT NULL;

-- Create notifications table for deletion warnings
CREATE TABLE IF NOT EXISTS data_retention_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  upload_id uuid REFERENCES data_center_uploads(id) ON DELETE CASCADE,
  notification_type text NOT NULL, -- 'deletion_warning', 'archived', 'deleted'
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE data_retention_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own notifications"
ON data_retention_notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON data_retention_notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Index for efficient notification queries
CREATE INDEX IF NOT EXISTS idx_data_retention_notifications_user 
ON data_retention_notifications(user_id, created_at DESC);