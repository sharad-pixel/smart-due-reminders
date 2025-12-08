-- Add RLS policy to allow users to insert documents with their own user_id as uploaded_by_user_id
-- This allows document uploads even when no organization or debtor is specified

CREATE POLICY "Users can insert their own documents"
ON public.documents
FOR INSERT
WITH CHECK (
  auth.uid() = uploaded_by_user_id
);

-- Add SELECT policy for documents owned by the uploader
CREATE POLICY "Users can view their own uploaded documents"
ON public.documents
FOR SELECT
USING (
  auth.uid() = uploaded_by_user_id
);

-- Add UPDATE policy for documents owned by the uploader
CREATE POLICY "Users can update their own uploaded documents"
ON public.documents
FOR UPDATE
USING (
  auth.uid() = uploaded_by_user_id
);

-- Add DELETE policy for documents owned by the uploader
CREATE POLICY "Users can delete their own uploaded documents"
ON public.documents
FOR DELETE
USING (
  auth.uid() = uploaded_by_user_id
);