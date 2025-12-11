-- Drop the existing check constraint and recreate with accounts included
ALTER TABLE public.data_center_uploads DROP CONSTRAINT IF EXISTS data_center_uploads_file_type_check;

ALTER TABLE public.data_center_uploads ADD CONSTRAINT data_center_uploads_file_type_check 
CHECK (file_type IN ('invoice_aging', 'payments', 'accounts'));