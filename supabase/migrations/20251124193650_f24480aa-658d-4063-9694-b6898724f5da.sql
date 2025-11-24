-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800, -- 50MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'text/csv'
  ]
);

-- Create storage policies for documents bucket
CREATE POLICY "Users can view documents they have access to"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND (
      -- Organization documents
      EXISTS (
        SELECT 1 FROM public.documents d
        LEFT JOIN public.organizations o ON d.organization_id = o.id
        LEFT JOIN public.account_users au ON au.account_id = o.id
        WHERE d.file_url = storage.objects.name
        AND (
          o.owner_user_id = auth.uid()
          OR (au.user_id = auth.uid() AND au.status = 'active')
        )
      )
      OR
      -- Debtor documents
      EXISTS (
        SELECT 1 FROM public.documents d
        LEFT JOIN public.debtors deb ON d.debtor_id = deb.id
        WHERE d.file_url = storage.objects.name
        AND deb.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their organization documents"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'documents'
    AND (
      EXISTS (
        SELECT 1 FROM public.documents d
        LEFT JOIN public.organizations o ON d.organization_id = o.id
        LEFT JOIN public.account_users au ON au.account_id = o.id
        WHERE d.file_url = storage.objects.name
        AND (
          o.owner_user_id = auth.uid()
          OR (au.user_id = auth.uid() AND au.role IN ('owner', 'admin') AND au.status = 'active')
        )
      )
      OR
      EXISTS (
        SELECT 1 FROM public.documents d
        LEFT JOIN public.debtors deb ON d.debtor_id = deb.id
        WHERE d.file_url = storage.objects.name
        AND deb.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete their organization documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents'
    AND (
      EXISTS (
        SELECT 1 FROM public.documents d
        LEFT JOIN public.organizations o ON d.organization_id = o.id
        LEFT JOIN public.account_users au ON au.account_id = o.id
        WHERE d.file_url = storage.objects.name
        AND (
          o.owner_user_id = auth.uid()
          OR (au.user_id = auth.uid() AND au.role IN ('owner', 'admin') AND au.status = 'active')
        )
      )
      OR
      EXISTS (
        SELECT 1 FROM public.documents d
        LEFT JOIN public.debtors deb ON d.debtor_id = deb.id
        WHERE d.file_url = storage.objects.name
        AND deb.user_id = auth.uid()
      )
    )
  );