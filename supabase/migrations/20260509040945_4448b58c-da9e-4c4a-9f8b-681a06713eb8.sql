
-- ─────────────────────────────────────────────────────────────────────────
-- 1. Effective role on a workspace (resolves contacts → external access → owner)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clm_instance_role(p_user_id uuid, p_instance_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text;
  v_role text;
  v_account_id uuid;
  v_created_by uuid;
BEGIN
  IF p_user_id IS NULL OR p_instance_id IS NULL THEN RETURN NULL; END IF;

  SELECT account_id, created_by INTO v_account_id, v_created_by
    FROM public.clm_template_instances WHERE id = p_instance_id;
  IF v_account_id IS NULL THEN RETURN NULL; END IF;

  -- Account team members are owners by default
  IF public.can_write_as_account(p_user_id, v_account_id) THEN RETURN 'owner'; END IF;
  IF v_created_by = p_user_id THEN RETURN 'owner'; END IF;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = p_user_id;

  -- Internal instance contacts (matched by email)
  SELECT lower(role) INTO v_role
    FROM public.clm_instance_contacts
   WHERE instance_id = p_instance_id
     AND email IS NOT NULL
     AND lower(email) = v_email
   LIMIT 1;
  IF v_role IS NOT NULL THEN RETURN v_role; END IF;

  -- External access
  SELECT lower(role) INTO v_role
    FROM public.clm_external_access
   WHERE instance_id = p_instance_id
     AND lower(email) = v_email
     AND revoked_at IS NULL
   LIMIT 1;
  IF v_role IS NOT NULL THEN RETURN v_role; END IF;

  RETURN NULL;
END $$;

-- Capability helpers
CREATE OR REPLACE FUNCTION public.can_edit_clm_instance(p_user_id uuid, p_instance_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.clm_instance_role(p_user_id, p_instance_id) IN ('owner','editor','approver','legal');
$$;

CREATE OR REPLACE FUNCTION public.can_approve_clm_instance(p_user_id uuid, p_instance_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.clm_instance_role(p_user_id, p_instance_id) IN ('owner','approver','legal');
$$;

CREATE OR REPLACE FUNCTION public.can_view_clm_instance(p_user_id uuid, p_instance_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.clm_instance_role(p_user_id, p_instance_id) IS NOT NULL
      OR public.is_recouply_admin(p_user_id);
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Relax write RLS on sections/revisions/comments to include workspace editors
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Update instance sections" ON public.clm_instance_sections;
CREATE POLICY "Update instance sections" ON public.clm_instance_sections
FOR UPDATE TO authenticated
USING (public.can_edit_clm_instance(auth.uid(), instance_id))
WITH CHECK (public.can_edit_clm_instance(auth.uid(), instance_id));

DROP POLICY IF EXISTS "Write revisions" ON public.clm_section_revisions;
CREATE POLICY "Insert revisions" ON public.clm_section_revisions
FOR INSERT TO authenticated
WITH CHECK (public.can_edit_clm_instance(auth.uid(), instance_id));

CREATE POLICY "Update revisions" ON public.clm_section_revisions
FOR UPDATE TO authenticated
USING (public.can_edit_clm_instance(auth.uid(), instance_id))
WITH CHECK (public.can_edit_clm_instance(auth.uid(), instance_id));

DROP POLICY IF EXISTS "Insert revision comments" ON public.clm_revision_comments;
CREATE POLICY "Insert revision comments" ON public.clm_revision_comments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.clm_template_instances i WHERE i.id = instance_id
    AND public.can_view_clm_instance(auth.uid(), i.id))
  AND author_id = auth.uid()
);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. RPC: save section draft (atomic body update + revision log)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_clm_section_draft(
  p_section_id uuid,
  p_body text,
  p_title text DEFAULT NULL,
  p_change_summary text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_instance uuid;
  v_section_key text;
  v_section_title text;
  v_prev_body text;
  v_name text;
  v_rev_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;

  SELECT instance_id, section_key, COALESCE(p_title, title), body
    INTO v_instance, v_section_key, v_section_title, v_prev_body
    FROM public.clm_instance_sections WHERE id = p_section_id;
  IF v_instance IS NULL THEN RAISE EXCEPTION 'Section not found'; END IF;

  IF NOT public.can_edit_clm_instance(v_user, v_instance) THEN
    RAISE EXCEPTION 'You do not have edit permission on this contract workspace';
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_user;

  UPDATE public.clm_instance_sections
     SET body = p_body,
         title = COALESCE(p_title, title),
         updated_at = now()
   WHERE id = p_section_id;

  -- Only log a revision if the body actually changed
  IF v_prev_body IS DISTINCT FROM p_body THEN
    INSERT INTO public.clm_section_revisions (
      instance_id, section_id, section_key, section_title,
      previous_body, new_body, change_summary,
      edited_by, edited_by_name, approval_status, merge_status
    ) VALUES (
      v_instance, p_section_id, v_section_key, v_section_title,
      v_prev_body, p_body, NULLIF(p_change_summary, ''),
      v_user, v_name, 'auto', 'merged'
    ) RETURNING id INTO v_rev_id;
  END IF;

  RETURN v_rev_id;
END $$;

GRANT EXECUTE ON FUNCTION public.save_clm_section_draft(uuid, text, text, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. RPC: review revision (approver-only)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.review_clm_revision(
  p_revision_id uuid,
  p_decision text,           -- 'approved' | 'rejected'
  p_note text DEFAULT NULL,
  p_override_body text DEFAULT NULL,
  p_revert_on_reject boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_rev RECORD;
  v_name text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  IF p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected';
  END IF;

  SELECT * INTO v_rev FROM public.clm_section_revisions WHERE id = p_revision_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Revision not found'; END IF;
  IF v_rev.sealed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Revision is sealed and cannot be re-reviewed';
  END IF;
  IF NOT public.can_approve_clm_instance(v_user, v_rev.instance_id) THEN
    RAISE EXCEPTION 'Only Approver, Legal, or Owner can approve or reject changes';
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_user;

  IF p_decision = 'approved' AND p_override_body IS NOT NULL THEN
    UPDATE public.clm_section_revisions SET new_body = p_override_body WHERE id = p_revision_id;
  END IF;

  UPDATE public.clm_section_revisions
     SET approval_status = p_decision,
         reviewed_by = v_user,
         reviewed_by_name = v_name,
         reviewed_at = now(),
         review_note = NULLIF(p_note, '')
   WHERE id = p_revision_id;

  IF p_decision = 'approved' THEN
    UPDATE public.clm_instance_sections
       SET body = COALESCE(p_override_body, (SELECT new_body FROM public.clm_section_revisions WHERE id = p_revision_id)),
           updated_at = now()
     WHERE id = v_rev.section_id;
  ELSIF p_decision = 'rejected' AND p_revert_on_reject THEN
    UPDATE public.clm_instance_sections
       SET body = v_rev.previous_body, updated_at = now()
     WHERE id = v_rev.section_id;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.review_clm_revision(uuid, text, text, text, boolean) TO authenticated;
