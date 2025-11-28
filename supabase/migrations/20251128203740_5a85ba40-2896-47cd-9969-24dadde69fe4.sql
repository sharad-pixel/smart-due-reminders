-- Add new fields to collection_tasks table for email-based task creation
ALTER TABLE collection_tasks
ADD COLUMN IF NOT EXISTS from_email TEXT,
ADD COLUMN IF NOT EXISTS to_email TEXT,
ADD COLUMN IF NOT EXISTS subject TEXT,
ADD COLUMN IF NOT EXISTS level TEXT CHECK (level IN ('invoice', 'debtor')),
ADD COLUMN IF NOT EXISTS raw_email TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'user_created' CHECK (source IN ('email_reply', 'system', 'user_created'));

-- Add index for faster queries on level and source
CREATE INDEX IF NOT EXISTS idx_collection_tasks_level ON collection_tasks(level);
CREATE INDEX IF NOT EXISTS idx_collection_tasks_source ON collection_tasks(source);

-- Add comments explaining the fields
COMMENT ON COLUMN collection_tasks.from_email IS 'Email address of the sender when task is created from email reply';
COMMENT ON COLUMN collection_tasks.to_email IS 'Email address where reply was sent (e.g., invoice+123@recouply.ai)';
COMMENT ON COLUMN collection_tasks.subject IS 'Email subject line when task is created from email reply';
COMMENT ON COLUMN collection_tasks.level IS 'Scope of task: invoice-level or debtor-level';
COMMENT ON COLUMN collection_tasks.raw_email IS 'Full raw email content for reference';
COMMENT ON COLUMN collection_tasks.source IS 'How the task was created: email_reply, system, or user_created';