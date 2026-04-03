
ALTER TABLE public.ingestion_scanned_files 
ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Allow authenticated users to delete their own audit logs (for clear history)
CREATE POLICY "Users can delete own audit log" ON public.ingestion_audit_log
FOR DELETE TO authenticated USING (user_id = auth.uid());
