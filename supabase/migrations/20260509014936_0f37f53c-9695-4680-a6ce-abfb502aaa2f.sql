
-- Add resubmission lineage and notification tracking
ALTER TABLE public.clm_section_revisions
  ADD COLUMN IF NOT EXISTS parent_revision_id uuid REFERENCES public.clm_section_revisions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

-- Lightweight queue table for amendment notifications (drained by edge function)
CREATE TABLE IF NOT EXISTS public.clm_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid NOT NULL REFERENCES public.clm_section_revisions(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('assigned','approved','rejected')),
  recipient_email text NOT NULL,
  recipient_name text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_clm_notif_queue_pending ON public.clm_notification_queue (status, created_at) WHERE status = 'pending';

ALTER TABLE public.clm_notification_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages clm notification queue" ON public.clm_notification_queue;
CREATE POLICY "Service role manages clm notification queue"
ON public.clm_notification_queue FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Trigger: when a pending revision is created OR reassigned, enqueue an "assigned" notification
CREATE OR REPLACE FUNCTION public.enqueue_clm_revision_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
$$;

DROP TRIGGER IF EXISTS trg_clm_revision_assigned ON public.clm_section_revisions;
CREATE TRIGGER trg_clm_revision_assigned
AFTER INSERT OR UPDATE OF assigned_approver_email, approval_status
ON public.clm_section_revisions
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_clm_revision_assignment();

-- Trigger: on approval, write the proposed body to the live section; on rejection, notify editor
CREATE OR REPLACE FUNCTION public.handle_clm_revision_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_editor_email text;
BEGIN
  IF NEW.approval_status = OLD.approval_status THEN
    RETURN NEW;
  END IF;

  IF NEW.approval_status = 'approved' AND OLD.approval_status = 'pending' THEN
    -- Promote the proposed body to the live section
    UPDATE public.clm_instance_sections
       SET body = NEW.new_body
     WHERE id = NEW.section_id;
  END IF;

  IF NEW.approval_status IN ('approved','rejected') AND NEW.edited_by IS NOT NULL THEN
    SELECT email INTO v_editor_email FROM public.profiles WHERE id = NEW.edited_by;
    IF v_editor_email IS NOT NULL THEN
      INSERT INTO public.clm_notification_queue (revision_id, instance_id, event_type, recipient_email, recipient_name, payload)
      VALUES (
        NEW.id, NEW.instance_id,
        CASE WHEN NEW.approval_status = 'approved' THEN 'approved' ELSE 'rejected' END,
        lower(v_editor_email), NEW.edited_by_name,
        jsonb_build_object(
          'section_title', NEW.section_title,
          'section_key', NEW.section_key,
          'reviewer_name', NEW.reviewed_by_name,
          'review_note', NEW.review_note,
          'version_number', NEW.version_number
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clm_revision_decision ON public.clm_section_revisions;
CREATE TRIGGER trg_clm_revision_decision
AFTER UPDATE OF approval_status ON public.clm_section_revisions
FOR EACH ROW
EXECUTE FUNCTION public.handle_clm_revision_decision();
