
-- Create cron job for daily intelligence reports at 13:00 UTC
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing job if it exists
SELECT cron.unschedule('daily-intelligence-reports') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-intelligence-reports'
);

-- Schedule daily intelligence reports at 13:00 UTC (5 AM PT)
SELECT cron.schedule(
  'daily-intelligence-reports',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/daily-intelligence-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
