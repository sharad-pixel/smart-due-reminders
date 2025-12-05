-- Create storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('org-logos', 'org-logos', true, 2097152)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload own logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'org-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own logo
CREATE POLICY "Users can update own logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'org-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own logo
CREATE POLICY "Users can delete own logo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'org-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access to logos (for email rendering)
CREATE POLICY "Public read access for logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'org-logos');