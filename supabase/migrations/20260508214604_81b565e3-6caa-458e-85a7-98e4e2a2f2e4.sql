
CREATE TABLE IF NOT EXISTS public.clm_section_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.clm_template_instances(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.clm_instance_sections(id) ON DELETE CASCADE,
  section_key text,
  section_title text,
  previous_body text,
  new_body text,
  change_summary text,
  edited_by uuid,
  edited_by_name text,
  approval_status text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected' | 'auto'
  reviewed_by uuid,
  reviewed_by_name text,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clm_revisions_instance ON public.clm_section_revisions(instance_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clm_revisions_section ON public.clm_section_revisions(section_id, created_at DESC);

ALTER TABLE public.clm_section_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read revisions" ON public.clm_section_revisions
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clm_template_instances i
    WHERE i.id = instance_id
      AND (public.can_access_account_data(auth.uid(), i.account_id) OR public.is_recouply_admin(auth.uid())))
);

CREATE POLICY "Write revisions" ON public.clm_section_revisions
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.clm_template_instances i
    WHERE i.id = instance_id AND public.can_write_as_account(auth.uid(), i.account_id))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.clm_template_instances i
    WHERE i.id = instance_id AND public.can_write_as_account(auth.uid(), i.account_id))
);
