
-- 1. Assessment leads: admin SELECT
DROP POLICY IF EXISTS "Admins can read assessment leads" ON public.assessment_leads;
CREATE POLICY "Admins can read assessment leads"
ON public.assessment_leads
FOR SELECT
TO authenticated
USING (public.is_recouply_admin(auth.uid()));

-- 2. CLM engagement profiles: tighten writes
DROP POLICY IF EXISTS "Insert clm_engagement_profiles" ON public.clm_engagement_profiles;
DROP POLICY IF EXISTS "Delete clm_engagement_profiles" ON public.clm_engagement_profiles;
DROP POLICY IF EXISTS "Update clm_engagement_profiles" ON public.clm_engagement_profiles;
CREATE POLICY "Insert clm_engagement_profiles"
ON public.clm_engagement_profiles FOR INSERT TO authenticated
WITH CHECK (public.can_write_as_account(auth.uid(), account_id) OR public.is_recouply_admin(auth.uid()));
CREATE POLICY "Update clm_engagement_profiles"
ON public.clm_engagement_profiles FOR UPDATE TO authenticated
USING (public.can_write_as_account(auth.uid(), account_id) OR public.is_recouply_admin(auth.uid()))
WITH CHECK (public.can_write_as_account(auth.uid(), account_id) OR public.is_recouply_admin(auth.uid()));
CREATE POLICY "Delete clm_engagement_profiles"
ON public.clm_engagement_profiles FOR DELETE TO authenticated
USING (public.can_write_as_account(auth.uid(), account_id) OR public.is_recouply_admin(auth.uid()));

-- 3. CLM workspace approval routing / compliance reqs / required documents
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clm_workspace_approval_routing','clm_workspace_compliance_requirements','clm_workspace_required_documents']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Insert %1$s" ON public.%1$s;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Update %1$s" ON public.%1$s;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Delete %1$s" ON public.%1$s;', t);
    EXECUTE format($p$CREATE POLICY "Insert %1$s" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (public.can_write_as_account(auth.uid(), account_id) OR public.is_recouply_admin(auth.uid()));$p$, t);
    EXECUTE format($p$CREATE POLICY "Update %1$s" ON public.%1$s FOR UPDATE TO authenticated USING (public.can_write_as_account(auth.uid(), account_id) OR public.is_recouply_admin(auth.uid())) WITH CHECK (public.can_write_as_account(auth.uid(), account_id) OR public.is_recouply_admin(auth.uid()));$p$, t);
    EXECUTE format($p$CREATE POLICY "Delete %1$s" ON public.%1$s FOR DELETE TO authenticated USING (public.can_write_as_account(auth.uid(), account_id) OR public.is_recouply_admin(auth.uid()));$p$, t);
  END LOOP;
END $$;

-- 4. Compliance document storage: tighten writes
DROP POLICY IF EXISTS "Admins upload compliance docs" ON storage.objects;
DROP POLICY IF EXISTS "Admins update compliance docs" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete compliance docs" ON storage.objects;

CREATE POLICY "Account writers upload compliance docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'compliance-documents'
  AND public.can_write_as_account(
    auth.uid(),
    NULLIF((storage.foldername(name))[1], '')::uuid
  )
);

CREATE POLICY "Account writers update compliance docs"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'compliance-documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.compliance_documents cd
      WHERE cd.storage_path = storage.objects.name
        AND public.can_write_as_account(auth.uid(), cd.account_id)
    )
    OR public.can_write_as_account(
      auth.uid(),
      NULLIF((storage.foldername(name))[1], '')::uuid
    )
  )
);

CREATE POLICY "Account writers delete compliance docs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'compliance-documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.compliance_documents cd
      WHERE cd.storage_path = storage.objects.name
        AND public.can_write_as_account(auth.uid(), cd.account_id)
    )
    OR public.can_write_as_account(
      auth.uid(),
      NULLIF((storage.foldername(name))[1], '')::uuid
    )
  )
);

-- 5. has_clm_access: add instance-scoped overload + replace usages
CREATE OR REPLACE FUNCTION public.has_clm_access(_user_id uuid, _instance_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clm_template_instances ti
    JOIN public.clm_entitlements ce ON ce.account_id = ti.account_id AND ce.status = 'active'
    WHERE ti.id = _instance_id
      AND (
        ti.account_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.account_users au
          WHERE au.user_id = _user_id
            AND au.account_id = ti.account_id
            AND au.status = 'active'
        )
        OR public.is_support_with_access(_user_id, ti.account_id)
      )
  );
$$;

-- Recreate policies that called has_clm_access(instance_id) so they bind to the 2-arg overload
DROP POLICY IF EXISTS "Workspace members read batches" ON public.clm_review_batches;
DROP POLICY IF EXISTS "Workspace members create batches" ON public.clm_review_batches;
DROP POLICY IF EXISTS "Workspace members update batches" ON public.clm_review_batches;
DROP POLICY IF EXISTS "Read versions" ON public.clm_document_versions;

CREATE POLICY "Workspace members read batches"
ON public.clm_review_batches FOR SELECT TO authenticated
USING (public.has_clm_access(auth.uid(), instance_id));

CREATE POLICY "Workspace members create batches"
ON public.clm_review_batches FOR INSERT TO authenticated
WITH CHECK (public.has_clm_access(auth.uid(), instance_id) AND submitted_by = auth.uid());

CREATE POLICY "Workspace members update batches"
ON public.clm_review_batches FOR UPDATE TO authenticated
USING (public.has_clm_access(auth.uid(), instance_id))
WITH CHECK (public.has_clm_access(auth.uid(), instance_id));

CREATE POLICY "Read versions"
ON public.clm_document_versions FOR SELECT TO authenticated
USING (public.has_clm_access(auth.uid(), instance_id));
