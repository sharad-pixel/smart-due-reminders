
CREATE OR REPLACE FUNCTION public.clm_current_actor()
 RETURNS TABLE(actor_id uuid, actor_name text, actor_email text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT v_uid, p.name, p.email FROM public.profiles p WHERE p.id = v_uid;
END $function$;

CREATE OR REPLACE FUNCTION public.save_clm_section_draft(p_section_id uuid, p_body text, p_title text DEFAULT NULL::text, p_change_summary text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  SELECT name INTO v_name FROM public.profiles WHERE id = v_user;
  UPDATE public.clm_instance_sections
     SET body = p_body, title = COALESCE(p_title, title), updated_at = now()
   WHERE id = p_section_id;
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
END $function$;

CREATE OR REPLACE FUNCTION public.review_clm_revision(p_revision_id uuid, p_decision text, p_note text DEFAULT NULL::text, p_override_body text DEFAULT NULL::text, p_revert_on_reject boolean DEFAULT false)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  SELECT name INTO v_name FROM public.profiles WHERE id = v_user;
  IF p_decision = 'approved' AND p_override_body IS NOT NULL THEN
    UPDATE public.clm_section_revisions SET new_body = p_override_body WHERE id = p_revision_id;
  END IF;
  UPDATE public.clm_section_revisions
     SET approval_status = p_decision, reviewed_by = v_user, reviewed_by_name = v_name,
         reviewed_at = now(), review_note = NULLIF(p_note, '')
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
END $function$;

CREATE OR REPLACE FUNCTION public.revert_clm_revision(p_revision_id uuid, p_note text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_rev RECORD;
  v_current_body text;
  v_new_id uuid;
  v_user uuid := auth.uid();
  v_name text;
BEGIN
  SELECT * INTO v_rev FROM public.clm_section_revisions WHERE id = p_revision_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Revision % not found', p_revision_id; END IF;
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
  SELECT name INTO v_name FROM public.profiles WHERE id = v_user;
  UPDATE public.clm_instance_sections SET body = v_rev.previous_body, updated_at = now() WHERE id = v_rev.section_id;
  UPDATE public.clm_section_revisions SET merge_status = 'reverted' WHERE id = p_revision_id;
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
  ) RETURNING id INTO v_new_id;
  RETURN v_new_id;
END $function$;

CREATE OR REPLACE FUNCTION public.submit_clm_review_batch(p_instance_id uuid, p_revision_ids uuid[], p_approver_email text, p_approver_name text, p_message text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_full_name text;
  v_batch_id uuid;
  v_count int;
  v_sections jsonb;
  v_first_rev uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  IF NOT public.has_clm_access(p_instance_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_revision_ids IS NULL OR array_length(p_revision_ids,1) IS NULL THEN
    RAISE EXCEPTION 'No revisions to submit';
  END IF;
  SELECT email, name INTO v_email, v_full_name FROM public.profiles WHERE id = v_user;
  INSERT INTO public.clm_review_batches
    (instance_id, submitted_by, submitted_by_name, submitted_by_email,
     approver_email, approver_name, message, revision_count)
  VALUES
    (p_instance_id, v_user, v_full_name, v_email,
     lower(p_approver_email), p_approver_name, p_message,
     array_length(p_revision_ids,1))
  RETURNING id INTO v_batch_id;
  UPDATE public.clm_section_revisions
     SET submitted_batch_id = v_batch_id, approval_status = 'pending',
         assigned_approver_email = lower(p_approver_email),
         assigned_approver_name = p_approver_name, assigned_at = now()
   WHERE id = ANY(p_revision_ids) AND instance_id = p_instance_id
     AND edited_by = v_user AND approval_status = 'auto'
     AND submitted_batch_id IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    DELETE FROM public.clm_review_batches WHERE id = v_batch_id;
    RAISE EXCEPTION 'No eligible drafts found';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'section_title', section_title, 'section_key', section_key,
            'change_summary', change_summary, 'version_number', version_number
         ) ORDER BY created_at), '[]'::jsonb),
         (array_agg(id ORDER BY created_at))[1]
    INTO v_sections, v_first_rev
    FROM public.clm_section_revisions WHERE submitted_batch_id = v_batch_id;
  INSERT INTO public.clm_notification_queue
    (revision_id, instance_id, event_type, recipient_email, recipient_name, payload)
  VALUES
    (v_first_rev, p_instance_id, 'batch_assigned',
     lower(p_approver_email), p_approver_name,
     jsonb_build_object(
       'submitted_by_name', v_full_name, 'submitted_by_email', v_email,
       'message', p_message, 'revision_count', v_count,
       'sections', v_sections, 'batch_id', v_batch_id));
  UPDATE public.clm_review_batches SET revision_count = v_count WHERE id = v_batch_id;
  RETURN v_batch_id;
END $function$;
