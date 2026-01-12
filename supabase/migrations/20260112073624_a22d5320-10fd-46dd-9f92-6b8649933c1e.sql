-- Add collection intelligence score fields to debtors table
ALTER TABLE public.debtors
ADD COLUMN IF NOT EXISTS collection_intelligence_score integer,
ADD COLUMN IF NOT EXISTS collection_health_tier text,
ADD COLUMN IF NOT EXISTS touchpoint_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS inbound_email_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS response_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_response_sentiment text,
ADD COLUMN IF NOT EXISTS last_touchpoint_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS collection_score_updated_at timestamp with time zone;

-- Enable realtime for debtors table to support live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.debtors;