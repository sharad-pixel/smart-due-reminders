-- Tighten clm-templates storage bucket policies to use account-based access (mirror compliance-documents pattern)
DROP POLICY IF EXISTS "Users can upload their own CLM templates" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own CLM templates" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own CLM templates" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own CLM templates" ON storage.objects;

-- READ: account members (or admin) for files referenced by a template/redline in their account,
-- with a folder-uuid fallback for newly-uploaded objects not yet linked.
CREATE POLICY "Account members read CLM template files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'clm-templates'
  AND (
    EXISTS (
      SELECT 1 FROM public.clm_templates t
      WHERE t.source_storage_path = storage.objects.name
        AND (public.can_access_account_data(auth.uid(), t.account_id) OR public.is_recouply_admin(auth.uid()))
    )
    OR EXISTS (
      SELECT 1 FROM public.clm_uploaded_redlines r
      WHERE r.storage_path = storage.objects.name
        AND (public.can_access_account_data(auth.uid(), r.account_id) OR public.is_recouply_admin(auth.uid()))
    )
    OR public.can_access_account_data(
      auth.uid(),
      NULLIF((storage.foldername(name))[1], '')::uuid
    )
    OR public.is_recouply_admin(auth.uid())
  )
);

-- INSERT: folder uuid must be an account the user can write as (covers new uploads before the
-- template/redline row is created), OR admin.
CREATE POLICY "Account writers upload CLM template files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'clm-templates'
  AND (
    public.can_write_as_account(
      auth.uid(),
      NULLIF((storage.foldername(name))[1], '')::uuid
    )
    OR public.is_recouply_admin(auth.uid())
  )
);

-- UPDATE
CREATE POLICY "Account writers update CLM template files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'clm-templates'
  AND (
    EXISTS (
      SELECT 1 FROM public.clm_templates t
      WHERE t.source_storage_path = storage.objects.name
        AND public.can_write_as_account(auth.uid(), t.account_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.clm_uploaded_redlines r
      WHERE r.storage_path = storage.objects.name
        AND public.can_write_as_account(auth.uid(), r.account_id)
    )
    OR public.can_write_as_account(
      auth.uid(),
      NULLIF((storage.foldername(name))[1], '')::uuid
    )
    OR public.is_recouply_admin(auth.uid())
  )
);

-- DELETE
CREATE POLICY "Account writers delete CLM template files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'clm-templates'
  AND (
    EXISTS (
      SELECT 1 FROM public.clm_templates t
      WHERE t.source_storage_path = storage.objects.name
        AND public.can_write_as_account(auth.uid(), t.account_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.clm_uploaded_redlines r
      WHERE r.storage_path = storage.objects.name
        AND public.can_write_as_account(auth.uid(), r.account_id)
    )
    OR public.can_write_as_account(
      auth.uid(),
      NULLIF((storage.foldername(name))[1], '')::uuid
    )
    OR public.is_recouply_admin(auth.uid())
  )
);