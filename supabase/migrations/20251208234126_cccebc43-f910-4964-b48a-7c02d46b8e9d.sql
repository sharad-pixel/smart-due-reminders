-- Add is_archived field to collection_tasks table
ALTER TABLE public.collection_tasks 
ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

-- Add archived_at timestamp for audit trail
ALTER TABLE public.collection_tasks 
ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

-- Create index for efficient filtering of non-archived tasks
CREATE INDEX IF NOT EXISTS idx_collection_tasks_is_archived 
ON public.collection_tasks(is_archived) 
WHERE is_archived = false;