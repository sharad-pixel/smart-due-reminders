-- Add slack_sent column to nicolas_escalations table
ALTER TABLE public.nicolas_escalations 
ADD COLUMN IF NOT EXISTS slack_sent boolean DEFAULT false;

-- Add additional columns to capture richer context
ALTER TABLE public.nicolas_escalations 
ADD COLUMN IF NOT EXISTS user_name text,
ADD COLUMN IF NOT EXISTS user_email text,
ADD COLUMN IF NOT EXISTS issue_category text,
ADD COLUMN IF NOT EXISTS urgency text;