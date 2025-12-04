-- Add inbound_email_id column to collection_tasks to link tasks to their source emails
ALTER TABLE public.collection_tasks 
ADD COLUMN IF NOT EXISTS inbound_email_id uuid REFERENCES public.inbound_emails(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_collection_tasks_inbound_email ON public.collection_tasks(inbound_email_id);

-- Add comment for documentation
COMMENT ON COLUMN public.collection_tasks.inbound_email_id IS 'Reference to the inbound email that generated this task via AI extraction';