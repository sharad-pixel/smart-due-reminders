
-- 1. Review batches table ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clm_review_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.clm_template_instances(id) ON DELETE CASCADE,
  submitted_by uuid,
  submitted_by_name text,
  submitted_by_email text,
  approver_email text NOT NULL,
  approver_name text,
  message text,
  revision_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','mixed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_clm_review_batches_instance
  ON public.clm_review_batches(instance_id, created_at DESC);

ALTER TABLE public.clm_review_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members read batches"
  ON public.clm_review_batches FOR SELECT
  USING (public.has_clm_access(instance_id));

CREATE POLICY "Workspace members create batches"
  ON public.clm_review_batches FOR INSERT
  WITH CHECK (public.has_clm_access(instance_id) AND submitted_by = auth.uid());

CREATE POLICY "Workspace members update batches"
  ON public.clm_review_batches FOR UPDATE
  USING (public.has_clm_access(instance_id));

-- 2. Link revisions to batch -----------------------------------------------
ALTER TABLE public.clm_section_revisions
  ADD COLUMN IF NOT EXISTS submitted_batch_id uuid
    REFERENCES public.clm_review_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clm_revisions_batch
  ON public.clm_section_revisions(submitted_batch_id);

-- 3. Allow new event_type on the notification queue ------------------------
ALTER TABLE public.clm_notification_queue
  DROP CONSTRAINT IF EXISTS clm_notification_queue_event_type_check;
ALTER TABLE public.clm_notification_queue
  ADD CONSTRAINT clm_notification_queue_event_type_check
  CHECK (event_type IN ('assigned','approved','rejected','batch_assigned'));

-- 4. Suppress per-revision assignment email when revision is in a batch ----
CREATE OR REPLACE FUNCTION public.enqueue_clm_revision_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip individual assignment emails for revisions that are part of a batch;
  -- the batch trigger will fire one digest email instead.
  IF NEW.submitted_batch_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.approval_status = 'pending'
     AND NEW.assigned_approver_email IS NOT NULL
     AND (TG_OP = 'INSERT'
          OR OLD.assigned_approver_email IS DISTINCT FROM NEW.assigned_approver_email
          OR OLD.approval_status IS DISTINCT FROM NEW.approval_status) THEN
    INSERT INTO public.clm_notification_queue (revision_id, instance_id, event_type, recipient_email, recipient_name, payload)
    VALUES (
      NEW.id, NEW.instance_id, 'assigned',
      lower(NEW.assigned_approver_email), NEW.assigned_approver_name,
      jsonb_build_object(
        'section_title', NEW.section_title,
        'section_key', NEW.section_key,
        'change_summary', NEW.change_summary,
        'edited_by_name', NEW.edited_by_name,
        'version_number', NEW.version_number
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. Batch enqueue trigger -------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_clm_batch_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sections jsonb;
BEGIN
  -- Build a digest of the section titles + change summaries in this batch
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'section_title', section_title,
            'section_key', section_key,
            'change_summary', change_summary,
            'version_number', version_number
         ) ORDER BY created_at), '[]'::jsonb)
    INTO v_sections
    FROM public.clm_section_revisions
   WHERE submitted_batch_id = NEW.id;

  INSERT INTO public.clm_notification_queue
    (revision_id, instance_id, event_type, recipient_email, recipient_name, payload)
  SELECT id, NEW.instance_id, 'batch_assigned',
         lower(NEW.approver_email), NEW.approver_name,
         jsonb_build_object(
           'submitted_by_name', NEW.submitted_by_name,
           'submitted_by_email', NEW.submitted_by_email,
           'message', NEW.message,
           'revision_count', NEW.revision_count,
           'sections', v_sections,
           'batch_id', NEW.id
         )
    FROM public.clm_section_revisions
   WHERE submitted_batch_id = NEW.id
   ORDER BY created_at
   LIMIT 1;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_clm_batch_assigned ON public.clm_review_batches;
CREATE TRIGGER trg_clm_batch_assigned
  AFTER INSERT ON public.clm_review_batches
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_clm_batch_assignment();
