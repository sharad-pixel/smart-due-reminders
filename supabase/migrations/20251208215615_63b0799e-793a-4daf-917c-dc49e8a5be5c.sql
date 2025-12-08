-- Add notes column to collection_tasks for timestamped user notes
ALTER TABLE public.collection_tasks 
ADD COLUMN IF NOT EXISTS notes jsonb DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.collection_tasks.notes IS 'Array of notes with user_id, content, and created_at timestamp';