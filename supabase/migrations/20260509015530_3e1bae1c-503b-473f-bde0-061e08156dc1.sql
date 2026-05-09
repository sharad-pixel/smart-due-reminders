-- Kurt General Counsel agent: recommendation + chat tables
CREATE TYPE public.clm_kurt_recommendation_kind AS ENUM ('approve', 'request_changes', 'reject');

CREATE TABLE public.clm_kurt_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid NOT NULL REFERENCES public.clm_section_revisions(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES public.clm_template_instances(id) ON DELETE CASCADE,
  recommendation public.clm_kurt_recommendation_kind NOT NULL,
  confidence numeric NOT NULL DEFAULT 0,
  summary text NOT NULL,
  key_changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggested_edits jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (revision_id)
);

CREATE INDEX idx_kurt_recs_instance ON public.clm_kurt_recommendations(instance_id, created_at DESC);

ALTER TABLE public.clm_kurt_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read kurt recs" ON public.clm_kurt_recommendations
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.clm_template_instances i
  WHERE i.id = clm_kurt_recommendations.instance_id
    AND (public.can_access_account_data(auth.uid(), i.account_id) OR public.is_recouply_admin(auth.uid()))
));

CREATE POLICY "Service writes kurt recs" ON public.clm_kurt_recommendations
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Per-workspace Kurt chat history (internal users only)
CREATE TABLE public.clm_kurt_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.clm_template_instances(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_kurt_chat_instance ON public.clm_kurt_chat_messages(instance_id, created_at);

ALTER TABLE public.clm_kurt_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read kurt chat" ON public.clm_kurt_chat_messages
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.clm_template_instances i
  WHERE i.id = clm_kurt_chat_messages.instance_id
    AND (public.can_access_account_data(auth.uid(), i.account_id) OR public.is_recouply_admin(auth.uid()))
));

CREATE POLICY "Insert own kurt chat" ON public.clm_kurt_chat_messages
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.clm_template_instances i
    WHERE i.id = clm_kurt_chat_messages.instance_id
      AND public.can_write_as_account(auth.uid(), i.account_id)
  )
);

CREATE POLICY "Service writes kurt chat" ON public.clm_kurt_chat_messages
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Trigger: enqueue Kurt review when a pending revision is submitted
CREATE OR REPLACE FUNCTION public.enqueue_kurt_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approval_status = 'pending' THEN
    INSERT INTO public.clm_notification_queue (kind, revision_id, payload, status)
    VALUES ('kurt_review', NEW.id, jsonb_build_object('revision_id', NEW.id, 'instance_id', NEW.instance_id), 'pending');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clm_revision_kurt ON public.clm_section_revisions;
CREATE TRIGGER trg_clm_revision_kurt
AFTER INSERT ON public.clm_section_revisions
FOR EACH ROW EXECUTE FUNCTION public.enqueue_kurt_review();