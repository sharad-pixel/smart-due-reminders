-- Drop and recreate the source check constraint to include new AI extraction sources
ALTER TABLE public.collection_tasks DROP CONSTRAINT collection_tasks_source_check;

ALTER TABLE public.collection_tasks ADD CONSTRAINT collection_tasks_source_check 
CHECK (source = ANY (ARRAY['email_reply', 'system', 'user_created', 'ai_extraction', 'internal_communication']));