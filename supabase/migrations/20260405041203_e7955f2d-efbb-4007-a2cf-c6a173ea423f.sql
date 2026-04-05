-- Fix: Add "processing" to the status check constraint
ALTER TABLE public.inbound_emails DROP CONSTRAINT inbound_emails_status_check;
ALTER TABLE public.inbound_emails ADD CONSTRAINT inbound_emails_status_check 
  CHECK (status = ANY (ARRAY['received', 'linked', 'processing', 'processed', 'error']));

-- Add cron job to auto-trigger process-inbound-ai every 2 minutes
SELECT cron.schedule(
  'process-inbound-ai-cron',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url:='https://kguurazunazhhrhasahd.supabase.co/functions/v1/process-inbound-ai',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVyYXp1bmF6aGhyaGFzYWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NjQyNzMsImV4cCI6MjA3OTM0MDI3M30.9pSbWiSKOwO5YkoRwtE2-pgjtxXSBhD59RwxA1fYsMY"}'::jsonb,
    body:='{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);