-- Update documents bucket to be public so AR page can display documents
UPDATE storage.buckets SET public = true WHERE id = 'documents';

-- Add policy to allow public access to documents marked as public_visible
CREATE POLICY "Public documents are accessible to everyone"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' 
  AND EXISTS (
    SELECT 1 FROM public.documents d 
    WHERE d.file_url = name 
    AND d.public_visible = true
  )
);