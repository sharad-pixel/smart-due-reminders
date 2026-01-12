-- Add dismissed_errors column to track manually overridden sync errors
ALTER TABLE public.quickbooks_sync_log 
ADD COLUMN IF NOT EXISTS dismissed_errors jsonb DEFAULT '[]'::jsonb;

-- Add a comment to explain the column
COMMENT ON COLUMN public.quickbooks_sync_log.dismissed_errors IS 'Array of error messages that have been manually dismissed by the user after aligning with source system';