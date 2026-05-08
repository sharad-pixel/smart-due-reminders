
CREATE TABLE IF NOT EXISTS public.clm_instance_extra_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.clm_template_instances(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.clm_templates(id) ON DELETE CASCADE,
  template_name_snapshot text,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, template_id)
);

ALTER TABLE public.clm_instance_extra_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read extra templates" ON public.clm_instance_extra_templates
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clm_template_instances i
    WHERE i.id = instance_id
      AND (public.can_access_account_data(auth.uid(), i.account_id) OR public.is_recouply_admin(auth.uid())))
);

CREATE POLICY "Write extra templates" ON public.clm_instance_extra_templates
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.clm_template_instances i
    WHERE i.id = instance_id AND public.can_write_as_account(auth.uid(), i.account_id))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.clm_template_instances i
    WHERE i.id = instance_id AND public.can_write_as_account(auth.uid(), i.account_id))
);

ALTER TABLE public.clm_instance_sections
  ADD COLUMN IF NOT EXISTS source_template_id uuid,
  ADD COLUMN IF NOT EXISTS source_template_name text;

ALTER TABLE public.clm_instance_contacts
  ALTER COLUMN debtor_id DROP NOT NULL,
  ALTER COLUMN contact_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS title text;
