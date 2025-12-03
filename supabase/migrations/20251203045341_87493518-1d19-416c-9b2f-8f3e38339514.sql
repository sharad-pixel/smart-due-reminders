-- Add AI categorization and action tracking columns to inbound_emails
ALTER TABLE public.inbound_emails 
ADD COLUMN IF NOT EXISTS ai_category text,
ADD COLUMN IF NOT EXISTS ai_priority text DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS ai_sentiment text,
ADD COLUMN IF NOT EXISTS action_status text DEFAULT 'open',
ADD COLUMN IF NOT EXISTS action_closed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS action_closed_by uuid,
ADD COLUMN IF NOT EXISTS action_notes text,
ADD COLUMN IF NOT EXISTS forwarded_to jsonb,
ADD COLUMN IF NOT EXISTS forwarded_at timestamp with time zone;

-- Add index for filtering by action status
CREATE INDEX IF NOT EXISTS idx_inbound_emails_action_status ON public.inbound_emails(action_status);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_ai_category ON public.inbound_emails(ai_category);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_ai_priority ON public.inbound_emails(ai_priority);