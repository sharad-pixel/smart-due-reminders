
-- ─────────────────────────────────────────────────────────────────────────
-- 1. Audit log table
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clm_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.clm_template_instances(id) ON DELETE CASCADE,
  revision_id uuid REFERENCES public.clm_section_revisions(id) ON DELETE SET NULL,
  section_id uuid,
  section_title text,
  event_type text NOT NULL,
  actor_id uuid,
  actor_name text,
  actor_email text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clm_audit_log_instance ON public.clm_audit_log(instance_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clm_audit_log_revision ON public.clm_audit_log(revision_id);

ALTER TABLE public.clm_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read audit log" ON public.clm_audit_log;
CREATE POLICY "Read audit log" ON public.clm_audit_log FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.clm_template_instances i
  WHERE i.id = instance_id
    AND (public.can_access_account_data(auth.uid(), i.account_id) OR public.is_recouply_admin(auth.uid()))
));

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Helper to resolve the acting user's display info
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clm_current_actor()
RETURNS TABLE(actor_id uuid, actor_name text, actor_email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text;
    RETURN;
  END IF;
  RETURN QUERY
    SELECT v_uid, p.full_name, p.email FROM public.profiles p WHERE p.id = v_uid;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Trigger on clm_section_revisions
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clm_audit_revision_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor record;
  v_event text;
  v_payload jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO v_actor FROM public.clm_current_actor();

  IF TG_OP = 'INSERT' THEN
    IF NEW.reverted_from_revision_id IS NOT NULL THEN
      v_event := 'reverted';
      v_payload := jsonb_build_object(
        'reverted_from_revision_id', NEW.reverted_from_revision_id,
        'change_summary', NEW.change_summary,
        'version_number', NEW.version_number
      );
    ELSIF NEW.approval_status = 'pending' THEN
      v_event := 'submitted';
      v_payload := jsonb_build_object(
        'version_number', NEW.version_number,
        'change_summary', NEW.change_summary,
        'assigned_approver_email', NEW.assigned_approver_email
      );
    ELSE
      v_event := 'edited';
      v_payload := jsonb_build_object(
        'version_number', NEW.version_number,
        'change_summary', NEW.change_summary,
        'approval_status', NEW.approval_status
      );
    END IF;

    INSERT INTO public.clm_audit_log (instance_id, revision_id, section_id, section_title, event_type, actor_id, actor_name, actor_email, payload)
    VALUES (NEW.instance_id, NEW.id, NEW.section_id, NEW.section_title, v_event,
            COALESCE(NEW.edited_by, v_actor.actor_id),
            COALESCE(NEW.edited_by_name, v_actor.actor_name),
            v_actor.actor_email, v_payload);

  ELSIF TG_OP = 'UPDATE' THEN
    -- Approval / rejection
    IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
       AND NEW.approval_status IN ('approved','rejected') THEN
      INSERT INTO public.clm_audit_log (instance_id, revision_id, section_id, section_title, event_type, actor_id, actor_name, actor_email, payload)
      VALUES (NEW.instance_id, NEW.id, NEW.section_id, NEW.section_title,
              CASE WHEN NEW.approval_status = 'approved' THEN 'approved' ELSE 'rejected' END,
              COALESCE(NEW.reviewed_by, v_actor.actor_id),
              COALESCE(NEW.reviewed_by_name, v_actor.actor_name),
              v_actor.actor_email,
              jsonb_build_object('version_number', NEW.version_number, 'review_note', NEW.review_note));
    END IF;

    -- Reverted (merge_status flipped)
    IF NEW.merge_status IS DISTINCT FROM OLD.merge_status AND NEW.merge_status = 'reverted' THEN
      INSERT INTO public.clm_audit_log (instance_id, revision_id, section_id, section_title, event_type, actor_id, actor_name, actor_email, payload)
      VALUES (NEW.instance_id, NEW.id, NEW.section_id, NEW.section_title, 'marked_reverted',
              v_actor.actor_id, v_actor.actor_name, v_actor.actor_email,
              jsonb_build_object('version_number', NEW.version_number));
    END IF;

    -- Sealed
    IF NEW.sealed_at IS DISTINCT FROM OLD.sealed_at AND NEW.sealed_at IS NOT NULL THEN
      INSERT INTO public.clm_audit_log (instance_id, revision_id, section_id, section_title, event_type, actor_id, actor_name, actor_email, payload)
      VALUES (NEW.instance_id, NEW.id, NEW.section_id, NEW.section_title, 'sealed',
              v_actor.actor_id, v_actor.actor_name, v_actor.actor_email,
              jsonb_build_object('version_number', NEW.version_number));
    END IF;

    -- Reviewers added/changed
    IF NEW.requested_reviewers IS DISTINCT FROM OLD.requested_reviewers THEN
      INSERT INTO public.clm_audit_log (instance_id, revision_id, section_id, section_title, event_type, actor_id, actor_name, actor_email, payload)
      VALUES (NEW.instance_id, NEW.id, NEW.section_id, NEW.section_title, 'review_requested',
              v_actor.actor_id, v_actor.actor_name, v_actor.actor_email,
              jsonb_build_object('reviewers', NEW.requested_reviewers));
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_clm_audit_revision ON public.clm_section_revisions;
CREATE TRIGGER trg_clm_audit_revision
AFTER INSERT OR UPDATE ON public.clm_section_revisions
FOR EACH ROW EXECUTE FUNCTION public.clm_audit_revision_trigger();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Trigger on clm_revision_comments
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clm_audit_comment_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_section_id uuid; v_section_title text;
BEGIN
  SELECT section_id, section_title INTO v_section_id, v_section_title
    FROM public.clm_section_revisions WHERE id = NEW.revision_id;

  INSERT INTO public.clm_audit_log (instance_id, revision_id, section_id, section_title, event_type, actor_id, actor_name, actor_email, payload)
  VALUES (NEW.instance_id, NEW.revision_id, v_section_id, v_section_title, 'commented',
          NEW.author_id, NEW.author_name, NEW.author_email,
          jsonb_build_object('mentions', NEW.mentions, 'preview', LEFT(NEW.body, 280)));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_clm_audit_comment ON public.clm_revision_comments;
CREATE TRIGGER trg_clm_audit_comment
AFTER INSERT ON public.clm_revision_comments
FOR EACH ROW EXECUTE FUNCTION public.clm_audit_comment_trigger();

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Trigger on clm_review_batches
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clm_audit_batch_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.clm_audit_log (instance_id, event_type, actor_id, actor_name, actor_email, payload)
  VALUES (NEW.instance_id, 'batch_submitted', NEW.submitted_by, NEW.submitted_by_name, NEW.submitted_by_email,
          jsonb_build_object(
            'approver_email', NEW.approver_email,
            'approver_name', NEW.approver_name,
            'revision_count', NEW.revision_count,
            'message', NEW.message,
            'batch_id', NEW.id
          ));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_clm_audit_batch ON public.clm_review_batches;
CREATE TRIGGER trg_clm_audit_batch
AFTER INSERT ON public.clm_review_batches
FOR EACH ROW EXECUTE FUNCTION public.clm_audit_batch_trigger();

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Strengthen revert RPC: clearer errors, ensure body actually changes,
--    bump section updated_at so UI invalidations refresh it.
-- ─────────────────────────────────────────────────────────────────────────
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
  v_found boolean := false;
BEGIN
  SELECT * INTO v_rev FROM public.clm_section_revisions WHERE id = p_revision_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Revision % not found', p_revision_id;
  END IF;
  IF v_rev.sealed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Revision is sealed (approved on a finalized workspace) and cannot be reverted';
  END IF;
  IF v_rev.merge_status = 'reverted' THEN
    RAISE EXCEPTION 'Revision was already reverted';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.clm_template_instances i
    WHERE i.id = v_rev.instance_id AND public.can_write_as_account(v_user, i.account_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized to revert in this workspace';
  END IF;

  SELECT body INTO v_current_body FROM public.clm_instance_sections WHERE id = v_rev.section_id;
  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_user;

  UPDATE public.clm_instance_sections
     SET body = v_rev.previous_body,
         updated_at = now()
   WHERE id = v_rev.section_id;

  UPDATE public.clm_section_revisions
     SET merge_status = 'reverted'
   WHERE id = p_revision_id;

  INSERT INTO public.clm_section_revisions (
    instance_id, section_id, section_key, section_title,
    previous_body, new_body, change_summary,
    edited_by, edited_by_name, approval_status, merge_status,
    reverted_from_revision_id
  ) VALUES (
    v_rev.instance_id, v_rev.section_id, v_rev.section_key, v_rev.section_title,
    v_current_body, v_rev.previous_body,
    COALESCE(NULLIF(p_note,''), 'Reverted v' || COALESCE(v_rev.version_number::text, '?')),
    v_user, v_name, 'auto', 'merged',
    p_revision_id
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revert_clm_revision(uuid, text) TO authenticated;
