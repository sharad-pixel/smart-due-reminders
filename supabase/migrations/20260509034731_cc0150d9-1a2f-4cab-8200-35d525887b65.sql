
-- 1. New columns on clm_section_revisions
ALTER TABLE public.clm_section_revisions
  ADD COLUMN IF NOT EXISTS merge_status text NOT NULL DEFAULT 'merged',
  ADD COLUMN IF NOT EXISTS requested_reviewers text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sealed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reverted_from_revision_id uuid REFERENCES public.clm_section_revisions(id) ON DELETE SET NULL;

-- 2. Revision comments table
CREATE TABLE IF NOT EXISTS public.clm_revision_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid NOT NULL REFERENCES public.clm_section_revisions(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES public.clm_template_instances(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES public.clm_revision_comments(id) ON DELETE CASCADE,
  author_id uuid,
  author_email text,
  author_name text,
  body text NOT NULL,
  mentions text[] NOT NULL DEFAULT '{}',
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clm_revision_comments_revision ON public.clm_revision_comments(revision_id, created_at);
CREATE INDEX IF NOT EXISTS idx_clm_revision_comments_instance ON public.clm_revision_comments(instance_id);

ALTER TABLE public.clm_revision_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read revision comments" ON public.clm_revision_comments;
CREATE POLICY "Read revision comments" ON public.clm_revision_comments FOR SELECT
USING (EXISTS (SELECT 1 FROM public.clm_template_instances i WHERE i.id = instance_id
  AND (public.can_access_account_data(auth.uid(), i.account_id) OR public.is_recouply_admin(auth.uid()))));

DROP POLICY IF EXISTS "Insert revision comments" ON public.clm_revision_comments;
CREATE POLICY "Insert revision comments" ON public.clm_revision_comments FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.clm_template_instances i WHERE i.id = instance_id
    AND public.can_write_as_account(auth.uid(), i.account_id))
);

DROP POLICY IF EXISTS "Update own revision comments" ON public.clm_revision_comments;
CREATE POLICY "Update own revision comments" ON public.clm_revision_comments FOR UPDATE
USING (author_id = auth.uid());

DROP POLICY IF EXISTS "Delete own revision comments" ON public.clm_revision_comments;
CREATE POLICY "Delete own revision comments" ON public.clm_revision_comments FOR DELETE
USING (author_id = auth.uid());

DROP TRIGGER IF EXISTS trg_clm_revision_comments_updated ON public.clm_revision_comments;
CREATE TRIGGER trg_clm_revision_comments_updated BEFORE UPDATE ON public.clm_revision_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Seal-on-approve trigger (locks revert once approved on an approved/executed workspace)
CREATE OR REPLACE FUNCTION public.clm_seal_revision_on_approve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF NEW.approval_status = 'approved' AND (OLD.approval_status IS DISTINCT FROM 'approved') THEN
    SELECT status INTO v_status FROM public.clm_template_instances WHERE id = NEW.instance_id;
    IF v_status IN ('approved','executed','archived') THEN
      NEW.sealed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clm_seal_revision ON public.clm_section_revisions;
CREATE TRIGGER trg_clm_seal_revision BEFORE UPDATE ON public.clm_section_revisions
FOR EACH ROW EXECUTE FUNCTION public.clm_seal_revision_on_approve();

-- 4. Revert RPC: produces an inverse revision and rolls the section body back
CREATE OR REPLACE FUNCTION public.revert_clm_revision(
  p_revision_id uuid,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rev RECORD;
  v_current_body text;
  v_new_id uuid;
  v_user uuid := auth.uid();
  v_name text;
BEGIN
  SELECT * INTO v_rev FROM public.clm_section_revisions WHERE id = p_revision_id;
  IF v_rev IS NULL THEN
    RAISE EXCEPTION 'Revision not found';
  END IF;
  IF v_rev.sealed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Revision is sealed and cannot be reverted';
  END IF;
  -- Authorization: must be able to write to this workspace
  IF NOT EXISTS (
    SELECT 1 FROM public.clm_template_instances i
    WHERE i.id = v_rev.instance_id AND public.can_write_as_account(v_user, i.account_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT body INTO v_current_body FROM public.clm_instance_sections WHERE id = v_rev.section_id;
  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_user;

  -- Roll the section body back to what existed BEFORE this revision was applied
  UPDATE public.clm_instance_sections
  SET body = v_rev.previous_body
  WHERE id = v_rev.section_id;

  -- Mark original as reverted
  UPDATE public.clm_section_revisions
  SET merge_status = 'reverted'
  WHERE id = p_revision_id;

  -- Log an inverse revision for the audit trail
  INSERT INTO public.clm_section_revisions (
    instance_id, section_id, section_key, section_title,
    previous_body, new_body, change_summary,
    edited_by, edited_by_name, approval_status, merge_status,
    reverted_from_revision_id
  ) VALUES (
    v_rev.instance_id, v_rev.section_id, v_rev.section_key, v_rev.section_title,
    v_current_body, v_rev.previous_body,
    COALESCE(p_note, 'Reverted v' || COALESCE(v_rev.version_number::text, '?')),
    v_user, v_name, 'auto', 'merged',
    p_revision_id
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revert_clm_revision(uuid, text) TO authenticated;

-- 5. Request reviewers RPC: tags collaborators for review on a specific revision
CREATE OR REPLACE FUNCTION public.request_clm_revision_review(
  p_revision_id uuid,
  p_emails text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance uuid;
  v_user uuid := auth.uid();
  v_clean text[];
BEGIN
  SELECT instance_id INTO v_instance FROM public.clm_section_revisions WHERE id = p_revision_id;
  IF v_instance IS NULL THEN RAISE EXCEPTION 'Revision not found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.clm_template_instances i
    WHERE i.id = v_instance AND public.can_write_as_account(v_user, i.account_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT lower(trim(e))) FILTER (WHERE e IS NOT NULL AND length(trim(e)) > 0), '{}')
    INTO v_clean
  FROM unnest(p_emails) e;

  UPDATE public.clm_section_revisions
  SET requested_reviewers = (
    SELECT COALESCE(array_agg(DISTINCT x), '{}')
    FROM unnest(coalesce(requested_reviewers,'{}') || v_clean) x
  )
  WHERE id = p_revision_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_clm_revision_review(uuid, text[]) TO authenticated;
