
DROP TRIGGER IF EXISTS trg_clm_batch_assigned ON public.clm_review_batches;
DROP FUNCTION IF EXISTS public.enqueue_clm_batch_assignment();

CREATE OR REPLACE FUNCTION public.submit_clm_review_batch(
  p_instance_id uuid,
  p_revision_ids uuid[],
  p_approver_email text,
  p_approver_name text,
  p_message text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  SELECT email, full_name INTO v_email, v_full_name FROM public.profiles WHERE id = v_user;

  INSERT INTO public.clm_review_batches
    (instance_id, submitted_by, submitted_by_name, submitted_by_email,
     approver_email, approver_name, message, revision_count)
  VALUES
    (p_instance_id, v_user, v_full_name, v_email,
     lower(p_approver_email), p_approver_name, p_message,
     array_length(p_revision_ids,1))
  RETURNING id INTO v_batch_id;

  -- Attach drafts to the batch and flip them to pending.
  -- per-revision trigger skips because submitted_batch_id IS NOT NULL.
  UPDATE public.clm_section_revisions
     SET submitted_batch_id = v_batch_id,
         approval_status = 'pending',
         assigned_approver_email = lower(p_approver_email),
         assigned_approver_name = p_approver_name,
         assigned_at = now()
   WHERE id = ANY(p_revision_ids)
     AND instance_id = p_instance_id
     AND edited_by = v_user
     AND approval_status = 'auto'
     AND submitted_batch_id IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    -- nothing to notify on; clean up
    DELETE FROM public.clm_review_batches WHERE id = v_batch_id;
    RAISE EXCEPTION 'No eligible drafts found';
  END IF;

  -- Build digest
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'section_title', section_title,
            'section_key', section_key,
            'change_summary', change_summary,
            'version_number', version_number
         ) ORDER BY created_at), '[]'::jsonb),
         (array_agg(id ORDER BY created_at))[1]
    INTO v_sections, v_first_rev
    FROM public.clm_section_revisions
   WHERE submitted_batch_id = v_batch_id;

  -- Single digest notification to the approver
  INSERT INTO public.clm_notification_queue
    (revision_id, instance_id, event_type, recipient_email, recipient_name, payload)
  VALUES
    (v_first_rev, p_instance_id, 'batch_assigned',
     lower(p_approver_email), p_approver_name,
     jsonb_build_object(
       'submitted_by_name', v_full_name,
       'submitted_by_email', v_email,
       'message', p_message,
       'revision_count', v_count,
       'sections', v_sections,
       'batch_id', v_batch_id
     ));

  -- Reflect actual count
  UPDATE public.clm_review_batches SET revision_count = v_count WHERE id = v_batch_id;

  RETURN v_batch_id;
END;
$function$;
