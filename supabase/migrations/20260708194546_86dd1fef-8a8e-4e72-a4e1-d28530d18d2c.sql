SELECT cron.unschedule('scheduled-outreach-engine')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scheduled-outreach-engine');

SELECT cron.schedule(
  'scheduled-outreach-engine',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://kguurazunazhhrhasahd.supabase.co/functions/v1/scheduled-outreach-engine',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVyYXp1bmF6aGhyaGFzYWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NjQyNzMsImV4cCI6MjA3OTM0MDI3M30.9pSbWiSKOwO5YkoRwtE2-pgjtxXSBhD59RwxA1fYsMY'
    ),
    body := '{"trigger_type":"cron"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.unschedule('auto-send-approved-drafts-catchup')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-send-approved-drafts-catchup');

SELECT cron.schedule(
  'auto-send-approved-drafts-catchup',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kguurazunazhhrhasahd.supabase.co/functions/v1/auto-send-approved-drafts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVyYXp1bmF6aGhyaGFzYWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NjQyNzMsImV4cCI6MjA3OTM0MDI3M30.9pSbWiSKOwO5YkoRwtE2-pgjtxXSBhD59RwxA1fYsMY'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);