
CREATE TABLE public.clm_instance_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.clm_template_instances(id) ON DELETE CASCADE,
  debtor_id uuid NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.debtor_contacts(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'reviewer',
  added_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, contact_id)
);

CREATE INDEX idx_clm_instance_contacts_inst ON public.clm_instance_contacts(instance_id);
CREATE INDEX idx_clm_instance_contacts_debtor ON public.clm_instance_contacts(debtor_id);

ALTER TABLE public.clm_instance_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read instance contacts" ON public.clm_instance_contacts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.clm_template_instances i
    WHERE i.id = clm_instance_contacts.instance_id
      AND (public.can_access_account_data(auth.uid(), i.account_id) OR public.is_recouply_admin(auth.uid()))
  )
);

CREATE POLICY "Write instance contacts" ON public.clm_instance_contacts
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.clm_template_instances i
    WHERE i.id = clm_instance_contacts.instance_id
      AND public.can_write_as_account(auth.uid(), i.account_id)
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clm_template_instances i
    WHERE i.id = clm_instance_contacts.instance_id
      AND public.can_write_as_account(auth.uid(), i.account_id)
  )
);
