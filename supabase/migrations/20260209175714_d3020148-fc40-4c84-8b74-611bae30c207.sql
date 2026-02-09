
-- Add column to track last manual sync
ALTER TABLE public.integration_sync_settings
ADD COLUMN IF NOT EXISTS last_manual_sync_at timestamptz;
