
-- 1. Status enum
DO $$ BEGIN
  CREATE TYPE public.clm_doc_version_status AS ENUM
    ('draft','pending','published','sealed','superseded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Versions table
CREATE TABLE IF NOT EXISTS public.clm_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.clm_template_instances(id) ON DELETE CASCADE,
  version_number int NOT NULL,
  label text,
  status public.clm_doc_version_status NOT NULL DEFAULT 'draft',
  snapshot_sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_by_name text,
  created_by_role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_by uuid,
  submitted_by_name text,
  submitted_at timestamptz,
  reviewed_by uuid,
  reviewed_by_name text,
  reviewed_by_role text,
  reviewed_at timestamptz,
  review_note text,
  sealed_by uuid,
  sealed_by_name text,
  sealed_at timestamptz,
  supersedes_version_id uuid REFERENCES public.clm_document_versions(id) ON DELETE SET NULL,
  UNIQUE(instance_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_clm_doc_versions_instance ON public.clm_document_versions(instance_id, version_number DESC);

ALTER TABLE public.clm_document_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read versions" ON public.clm_document_versions;
CREATE POLICY "Read versions" ON public.clm_document_versions FOR SELECT
USING (public.has_clm_access(instance_id));

-- writes only via SECURITY DEFINER RPCs
DROP POLICY IF EXISTS "Block direct writes" ON public.clm_document_versions;
CREATE POLICY "Block direct writes" ON public.clm_document_versions FOR ALL
USING (false) WITH CHECK (false);

-- 3. Link instance to current draft + revisions to a version
ALTER TABLE public.clm_template_instances
  ADD COLUMN IF NOT EXISTS current_version_id uuid REFERENCES public.clm_document_versions(id) ON DELETE SET NULL;

ALTER TABLE public.clm_section_revisions
  ADD COLUMN IF NOT EXISTS document_version_id uuid REFERENCES public.clm_document_versions(id) ON DELETE SET NULL;

-- 4. Role helpers
CREATE OR REPLACE FUNCTION public.can_seal_clm_instance(p_user_id uuid, p_instance_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.clm_instance_role(p_user_id, p_instance_id) IN ('owner','legal','signer');
$$;

CREATE OR REPLACE FUNCTION public.can_revert_clm_instance(p_user_id uuid, p_instance_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.clm_instance_role(p_user_id, p_instance_id) IN ('owner','legal','approver');
$$;

-- 5. Helper: ensure an active draft version exists, return its id
CREATE OR REPLACE FUNCTION public.ensure_clm_draft_version(p_instance_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_user uuid := auth.uid();
  v_name text;
  v_role text;
  v_next int;
BEGIN
  SELECT current_version_id INTO v_id FROM public.clm_template_instances WHERE id = p_instance_id;
  IF v_id IS NOT NULL THEN
    -- only return if the linked version is still a draft
    IF EXISTS (SELECT 1 FROM public.clm_document_versions WHERE id = v_id AND status = 'draft') THEN
      RETURN v_id;
    END IF;
  END IF;
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next
    FROM public.clm_document_versions WHERE instance_id = p_instance_id;
  SELECT name INTO v_name FROM public.profiles WHERE id = v_user;
  v_role := public.clm_instance_role(v_user, p_instance_id);
  INSERT INTO public.clm_document_versions
    (instance_id, version_number, status, created_by, created_by_name, created_by_role)
  VALUES
    (p_instance_id, v_next, 'draft', v_user, v_name, v_role)
  RETURNING id INTO v_id;
  UPDATE public.clm_template_instances SET current_version_id = v_id WHERE id = p_instance_id;
  INSERT INTO public.clm_audit_log (instance_id, event_type, actor_id, actor_name, payload)
  VALUES (p_instance_id, 'version_opened', v_user, v_name,
          jsonb_build_object('version_number', v_next, 'role', v_role));
  RETURN v_id;
END $$;

-- 6. Patch save_clm_section_draft to stamp document_version_id
CREATE OR REPLACE FUNCTION public.save_clm_section_draft(
  p_section_id uuid, p_body text,
  p_title text DEFAULT NULL, p_change_summary text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_instance uuid;
  v_section_key text;
  v_section_title text;
  v_prev_body text;
  v_name text;
  v_rev_id uuid;
  v_version_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  SELECT instance_id, section_key, COALESCE(p_title, title), body
    INTO v_instance, v_section_key, v_section_title, v_prev_body
    FROM public.clm_instance_sections WHERE id = p_section_id;
  IF v_instance IS NULL THEN RAISE EXCEPTION 'Section not found'; END IF;
  IF NOT public.can_edit_clm_instance(v_user, v_instance) THEN
    RAISE EXCEPTION 'You do not have edit permission on this contract workspace';
  END IF;

  -- Block edits while a version is pending review or sealed
  IF EXISTS (
    SELECT 1 FROM public.clm_template_instances i
    JOIN public.clm_document_versions v ON v.id = i.current_version_id
    WHERE i.id = v_instance AND v.status IN ('pending','sealed')
  ) THEN
    RAISE EXCEPTION 'This workspace is locked: current version is in review or sealed';
  END IF;

  v_version_id := public.ensure_clm_draft_version(v_instance);

  SELECT name INTO v_name FROM public.profiles WHERE id = v_user;
  UPDATE public.clm_instance_sections
     SET body = p_body, title = COALESCE(p_title, title), updated_at = now()
   WHERE id = p_section_id;
  IF v_prev_body IS DISTINCT FROM p_body THEN
    INSERT INTO public.clm_section_revisions (
      instance_id, section_id, section_key, section_title,
      previous_body, new_body, change_summary,
      edited_by, edited_by_name, approval_status, merge_status,
      document_version_id
    ) VALUES (
      v_instance, p_section_id, v_section_key, v_section_title,
      v_prev_body, p_body, NULLIF(p_change_summary, ''),
      v_user, v_name, 'auto', 'merged', v_version_id
    ) RETURNING id INTO v_rev_id;
  END IF;
  RETURN v_rev_id;
END $$;

-- 7. Submit current draft version for review
CREATE OR REPLACE FUNCTION public.clm_submit_version_for_review(p_version_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_v RECORD;
  v_name text;
  v_snapshot jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  SELECT * INTO v_v FROM public.clm_document_versions WHERE id = p_version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Version not found'; END IF;
  IF v_v.status <> 'draft' THEN RAISE EXCEPTION 'Only a draft version can be submitted'; END IF;
  IF NOT public.can_edit_clm_instance(v_user, v_v.instance_id) THEN
    RAISE EXCEPTION 'You do not have permission to submit this version';
  END IF;
  SELECT name INTO v_name FROM public.profiles WHERE id = v_user;
  -- snapshot every section body now
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'section_id', id, 'section_key', section_key,
           'title', title, 'body', body, 'order_index', order_index
         ) ORDER BY order_index), '[]'::jsonb)
    INTO v_snapshot FROM public.clm_instance_sections WHERE instance_id = v_v.instance_id;
  UPDATE public.clm_document_versions
     SET status = 'pending', submitted_by = v_user, submitted_by_name = v_name,
         submitted_at = now(), snapshot_sections = v_snapshot
   WHERE id = p_version_id;
  INSERT INTO public.clm_audit_log (instance_id, event_type, actor_id, actor_name, payload)
  VALUES (v_v.instance_id, 'version_submitted', v_user, v_name,
          jsonb_build_object('version_number', v_v.version_number));
END $$;

-- 8. Approve / reject pending version
CREATE OR REPLACE FUNCTION public.clm_review_version(
  p_version_id uuid, p_decision text, p_note text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_v RECORD;
  v_name text;
  v_role text;
  v_prev_published uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  IF p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected';
  END IF;
  SELECT * INTO v_v FROM public.clm_document_versions WHERE id = p_version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Version not found'; END IF;
  IF v_v.status <> 'pending' THEN RAISE EXCEPTION 'Only pending versions can be reviewed'; END IF;
  IF NOT public.can_approve_clm_instance(v_user, v_v.instance_id) THEN
    RAISE EXCEPTION 'Only Approver, Legal, or Owner can approve or reject versions';
  END IF;
  SELECT name INTO v_name FROM public.profiles WHERE id = v_user;
  v_role := public.clm_instance_role(v_user, v_v.instance_id);

  IF p_decision = 'approved' THEN
    -- supersede previous published
    SELECT id INTO v_prev_published
      FROM public.clm_document_versions
     WHERE instance_id = v_v.instance_id AND status = 'published'
     ORDER BY version_number DESC LIMIT 1;
    IF v_prev_published IS NOT NULL THEN
      UPDATE public.clm_document_versions
         SET status = 'superseded' WHERE id = v_prev_published;
    END IF;
    UPDATE public.clm_document_versions
       SET status = 'published', reviewed_by = v_user, reviewed_by_name = v_name,
           reviewed_by_role = v_role, reviewed_at = now(), review_note = NULLIF(p_note,''),
           supersedes_version_id = v_prev_published
     WHERE id = p_version_id;
    -- clear instance current_version_id so next save opens a fresh draft
    UPDATE public.clm_template_instances
       SET current_version_id = NULL WHERE id = v_v.instance_id AND current_version_id = p_version_id;
    INSERT INTO public.clm_audit_log (instance_id, event_type, actor_id, actor_name, payload)
    VALUES (v_v.instance_id, 'version_approved', v_user, v_name,
            jsonb_build_object('version_number', v_v.version_number, 'note', p_note));
  ELSE
    UPDATE public.clm_document_versions
       SET status = 'draft', reviewed_by = v_user, reviewed_by_name = v_name,
           reviewed_by_role = v_role, reviewed_at = now(), review_note = NULLIF(p_note,''),
           submitted_at = NULL, submitted_by = NULL, submitted_by_name = NULL
     WHERE id = p_version_id;
    INSERT INTO public.clm_audit_log (instance_id, event_type, actor_id, actor_name, payload)
    VALUES (v_v.instance_id, 'version_rejected', v_user, v_name,
            jsonb_build_object('version_number', v_v.version_number, 'note', p_note));
  END IF;
END $$;

-- 9. Revert to a prior version (creates new draft from snapshot)
CREATE OR REPLACE FUNCTION public.clm_revert_to_version(p_target_version_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_target RECORD;
  v_name text;
  v_role text;
  v_new_id uuid;
  v_next int;
  v_section jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  SELECT * INTO v_target FROM public.clm_document_versions WHERE id = p_target_version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Target version not found'; END IF;
  IF v_target.status NOT IN ('published','superseded') THEN
    RAISE EXCEPTION 'You can only revert to a published or superseded version';
  END IF;
  IF NOT public.can_revert_clm_instance(v_user, v_target.instance_id) THEN
    RAISE EXCEPTION 'Only Approver, Legal, or Owner can revert versions';
  END IF;
  IF EXISTS (SELECT 1 FROM public.clm_document_versions
             WHERE instance_id = v_target.instance_id AND status = 'sealed') THEN
    RAISE EXCEPTION 'This workspace has a sealed version and cannot be reverted';
  END IF;

  SELECT name INTO v_name FROM public.profiles WHERE id = v_user;
  v_role := public.clm_instance_role(v_user, v_target.instance_id);

  -- close any open pending version (cannot revert while pending review)
  IF EXISTS (SELECT 1 FROM public.clm_document_versions
             WHERE instance_id = v_target.instance_id AND status = 'pending') THEN
    RAISE EXCEPTION 'Resolve the pending version before reverting';
  END IF;

  -- restore section bodies from snapshot
  FOR v_section IN SELECT jsonb_array_elements(v_target.snapshot_sections) LOOP
    UPDATE public.clm_instance_sections
       SET body = v_section->>'body',
           title = COALESCE(v_section->>'title', title),
           updated_at = now()
     WHERE id = (v_section->>'section_id')::uuid;
  END LOOP;

  -- open a fresh draft version anchored to the revert
  SELECT COALESCE(MAX(version_number),0) + 1 INTO v_next
    FROM public.clm_document_versions WHERE instance_id = v_target.instance_id;
  INSERT INTO public.clm_document_versions
    (instance_id, version_number, status, label,
     created_by, created_by_name, created_by_role,
     supersedes_version_id)
  VALUES
    (v_target.instance_id, v_next, 'draft',
     'Reverted from v' || v_target.version_number,
     v_user, v_name, v_role, v_target.id)
  RETURNING id INTO v_new_id;

  UPDATE public.clm_template_instances
     SET current_version_id = v_new_id WHERE id = v_target.instance_id;

  INSERT INTO public.clm_audit_log (instance_id, event_type, actor_id, actor_name, payload)
  VALUES (v_target.instance_id, 'version_reverted', v_user, v_name,
          jsonb_build_object(
            'reverted_to_version', v_target.version_number,
            'new_draft_version', v_next));
  RETURN v_new_id;
END $$;

-- 10. Seal a published version (lock forever)
CREATE OR REPLACE FUNCTION public.clm_seal_version(p_version_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_v RECORD;
  v_name text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  SELECT * INTO v_v FROM public.clm_document_versions WHERE id = p_version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Version not found'; END IF;
  IF v_v.status <> 'published' THEN
    RAISE EXCEPTION 'Only a published version can be sealed';
  END IF;
  IF NOT public.can_seal_clm_instance(v_user, v_v.instance_id) THEN
    RAISE EXCEPTION 'Only Owner, Legal, or Signer can seal a version';
  END IF;
  SELECT name INTO v_name FROM public.profiles WHERE id = v_user;
  UPDATE public.clm_document_versions
     SET status = 'sealed', sealed_by = v_user, sealed_by_name = v_name, sealed_at = now()
   WHERE id = p_version_id;
  INSERT INTO public.clm_audit_log (instance_id, event_type, actor_id, actor_name, payload)
  VALUES (v_v.instance_id, 'version_sealed', v_user, v_name,
          jsonb_build_object('version_number', v_v.version_number));
END $$;

-- 11. Manually open a new draft (e.g. after publish, before next save)
CREATE OR REPLACE FUNCTION public.clm_open_new_draft_version(p_instance_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  IF NOT public.can_edit_clm_instance(v_user, p_instance_id) THEN
    RAISE EXCEPTION 'You do not have permission to open a new draft';
  END IF;
  IF EXISTS (SELECT 1 FROM public.clm_document_versions
             WHERE instance_id = p_instance_id AND status = 'sealed') THEN
    RAISE EXCEPTION 'Workspace is sealed';
  END IF;
  RETURN public.ensure_clm_draft_version(p_instance_id);
END $$;

-- 12. Backfill: every existing instance gets v1 published + v2 draft
DO $$
DECLARE r RECORD; v_pub uuid; v_draft uuid; v_snap jsonb;
BEGIN
  FOR r IN SELECT id, created_by FROM public.clm_template_instances
           WHERE NOT EXISTS (SELECT 1 FROM public.clm_document_versions v WHERE v.instance_id = clm_template_instances.id)
  LOOP
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'section_id', id, 'section_key', section_key,
             'title', title, 'body', body, 'order_index', order_index
           ) ORDER BY order_index), '[]'::jsonb)
      INTO v_snap FROM public.clm_instance_sections WHERE instance_id = r.id;
    INSERT INTO public.clm_document_versions
      (instance_id, version_number, status, label, snapshot_sections, created_by, created_by_role,
       reviewed_by, reviewed_at)
    VALUES
      (r.id, 1, 'published', 'Initial baseline', v_snap, r.created_by, 'owner',
       r.created_by, now())
    RETURNING id INTO v_pub;
    INSERT INTO public.clm_document_versions
      (instance_id, version_number, status, created_by, created_by_role, supersedes_version_id)
    VALUES (r.id, 2, 'draft', r.created_by, 'owner', v_pub)
    RETURNING id INTO v_draft;
    UPDATE public.clm_template_instances SET current_version_id = v_draft WHERE id = r.id;
  END LOOP;
END $$;
