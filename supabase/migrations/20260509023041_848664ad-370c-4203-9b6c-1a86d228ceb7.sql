
ALTER TABLE public.clm_section_revisions
  ADD COLUMN IF NOT EXISTS source_template_id uuid;

UPDATE public.clm_section_revisions r
SET source_template_id = s.source_template_id
FROM public.clm_instance_sections s
WHERE r.section_id = s.id
  AND r.source_template_id IS NULL
  AND s.source_template_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.clm_revision_set_source_template()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.source_template_id IS NULL AND NEW.section_id IS NOT NULL THEN
    SELECT source_template_id INTO NEW.source_template_id
    FROM public.clm_instance_sections WHERE id = NEW.section_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clm_revision_set_source_template_trg ON public.clm_section_revisions;
CREATE TRIGGER clm_revision_set_source_template_trg
BEFORE INSERT ON public.clm_section_revisions
FOR EACH ROW EXECUTE FUNCTION public.clm_revision_set_source_template();

CREATE TABLE IF NOT EXISTS public.clm_signature_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.clm_template_instances(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  created_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  provider text NOT NULL DEFAULT 'manual',
  included_templates jsonb NOT NULL DEFAULT '[]'::jsonb,
  signers jsonb NOT NULL DEFAULT '[]'::jsonb,
  external_envelope_id text,
  notes text,
  sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clm_sig_pkg_instance ON public.clm_signature_packages(instance_id);
CREATE INDEX IF NOT EXISTS idx_clm_sig_pkg_account ON public.clm_signature_packages(account_id);

ALTER TABLE public.clm_signature_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sig_pkg_select" ON public.clm_signature_packages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clm_template_instances i
    WHERE i.id = clm_signature_packages.instance_id
      AND i.account_id = public.get_effective_account_id(auth.uid())
  )
);

CREATE POLICY "sig_pkg_insert" ON public.clm_signature_packages
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.clm_template_instances i
    WHERE i.id = clm_signature_packages.instance_id
      AND i.account_id = public.get_effective_account_id(auth.uid())
  )
);

CREATE POLICY "sig_pkg_update" ON public.clm_signature_packages
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clm_template_instances i
    WHERE i.id = clm_signature_packages.instance_id
      AND i.account_id = public.get_effective_account_id(auth.uid())
  )
);

CREATE POLICY "sig_pkg_delete" ON public.clm_signature_packages
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clm_template_instances i
    WHERE i.id = clm_signature_packages.instance_id
      AND i.account_id = public.get_effective_account_id(auth.uid())
  )
);

CREATE TRIGGER update_clm_signature_packages_updated_at
BEFORE UPDATE ON public.clm_signature_packages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
