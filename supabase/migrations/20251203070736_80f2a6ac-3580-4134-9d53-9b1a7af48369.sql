-- Add assignment_email_sent_at field to track when assignment notification was sent
ALTER TABLE public.collection_tasks
ADD COLUMN IF NOT EXISTS assignment_email_sent_at TIMESTAMP WITH TIME ZONE;