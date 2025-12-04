-- Drop the existing check constraint
ALTER TABLE public.data_center_uploads DROP CONSTRAINT IF EXISTS data_center_uploads_status_check;

-- Add updated check constraint with 'archived' status
ALTER TABLE public.data_center_uploads 
ADD CONSTRAINT data_center_uploads_status_check 
CHECK (status IN ('uploaded', 'mapping', 'mapped', 'processing', 'processed', 'error', 'needs_review', 'archived'));