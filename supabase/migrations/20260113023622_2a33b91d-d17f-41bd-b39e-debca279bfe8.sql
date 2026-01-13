-- Create cron job to run the scheduled outreach engine daily at 8 AM UTC
-- This engine will:
-- 1. Cancel outreach for paid/terminal invoices
-- 2. Generate drafts for the next 7 days
-- 3. Send approved drafts due today

-- First, ensure pg_cron extension is enabled (if not already)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing job if it exists (to allow updates)
SELECT cron.unschedule('scheduled-outreach-engine') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'scheduled-outreach-engine'
);

-- Schedule the outreach engine to run daily at 8 AM UTC
SELECT cron.schedule(
  'scheduled-outreach-engine',
  '0 8 * * *',  -- Run at 8:00 AM UTC every day
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/scheduled-outreach-engine',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);