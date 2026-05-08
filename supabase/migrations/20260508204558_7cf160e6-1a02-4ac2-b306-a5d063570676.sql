
-- Storage bucket for source files
INSERT INTO storage.buckets (id, name, public) VALUES ('clm-templates', 'clm-templates', false)
ON CONFLICT (id) DO NOTHING;

-- Templates
CREATE TABLE public.clm_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  source_storage_path TEXT,
  source_file_name TEXT,
  mime_type TEXT,
  file_size_bytes INTEGER,
  raw_text TEXT,
  status TEXT NOT NULL DEFAULT 'uploading',
  parse_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clm_templates_account ON public.clm_templates(account_id);

ALTER TABLE public.clm_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members read templates" ON public.clm_templates FOR SELECT
USING (public.can_access_account_data(auth.uid(), account_id) OR public.is_recouply_admin(auth.uid()));

CREATE POLICY "Account members insert templates" ON public.clm_templates FOR INSERT
WITH CHECK (public.can_write_as_account(auth.uid(), account_id) AND created_by = auth.uid());

CREATE POLICY "Account members update templates" ON public.clm_templates FOR UPDATE
USING (public.can_write_as_account(auth.uid(), account_id));

CREATE POLICY "Account members delete templates" ON public.clm_templates FOR DELETE
USING (public.can_write_as_account(auth.uid(), account_id));

CREATE TRIGGER trg_clm_templates_updated BEFORE UPDATE ON public.clm_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sections
CREATE TABLE public.clm_template_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.clm_templates(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  ai_summary TEXT,
  risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clm_sections_template ON public.clm_template_sections(template_id);

ALTER TABLE public.clm_template_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read sections via template" ON public.clm_template_sections FOR SELECT
USING (EXISTS (SELECT 1 FROM public.clm_templates t WHERE t.id = template_id
  AND (public.can_access_account_data(auth.uid(), t.account_id) OR public.is_recouply_admin(auth.uid()))));

CREATE POLICY "Write sections via template" ON public.clm_template_sections FOR ALL
USING (EXISTS (SELECT 1 FROM public.clm_templates t WHERE t.id = template_id
  AND public.can_write_as_account(auth.uid(), t.account_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.clm_templates t WHERE t.id = template_id
  AND public.can_write_as_account(auth.uid(), t.account_id)));

CREATE TRIGGER trg_clm_sections_updated BEFORE UPDATE ON public.clm_template_sections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Instances
CREATE TABLE public.clm_template_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.clm_templates(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clm_instances_account ON public.clm_template_instances(account_id);
CREATE INDEX idx_clm_instances_template ON public.clm_template_instances(template_id);

ALTER TABLE public.clm_template_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read instances" ON public.clm_template_instances FOR SELECT
USING (public.can_access_account_data(auth.uid(), account_id) OR public.is_recouply_admin(auth.uid()));

CREATE POLICY "Insert instances" ON public.clm_template_instances FOR INSERT
WITH CHECK (public.can_write_as_account(auth.uid(), account_id) AND created_by = auth.uid());

CREATE POLICY "Update instances" ON public.clm_template_instances FOR UPDATE
USING (public.can_write_as_account(auth.uid(), account_id));

CREATE POLICY "Delete instances" ON public.clm_template_instances FOR DELETE
USING (public.can_write_as_account(auth.uid(), account_id));

CREATE TRIGGER trg_clm_instances_updated BEFORE UPDATE ON public.clm_template_instances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Instance ↔ Debtor links
CREATE TABLE public.clm_instance_debtors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.clm_template_instances(id) ON DELETE CASCADE,
  debtor_id UUID NOT NULL,
  added_by UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'counterparty',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instance_id, debtor_id)
);
CREATE INDEX idx_clm_instance_debtors_inst ON public.clm_instance_debtors(instance_id);

ALTER TABLE public.clm_instance_debtors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read instance debtors" ON public.clm_instance_debtors FOR SELECT
USING (EXISTS (SELECT 1 FROM public.clm_template_instances i WHERE i.id = instance_id
  AND (public.can_access_account_data(auth.uid(), i.account_id) OR public.is_recouply_admin(auth.uid()))));

CREATE POLICY "Write instance debtors" ON public.clm_instance_debtors FOR ALL
USING (EXISTS (SELECT 1 FROM public.clm_template_instances i WHERE i.id = instance_id
  AND public.can_write_as_account(auth.uid(), i.account_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.clm_template_instances i WHERE i.id = instance_id
  AND public.can_write_as_account(auth.uid(), i.account_id)));

-- Section comments
CREATE TABLE public.clm_section_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.clm_template_instances(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clm_section_comments_inst ON public.clm_section_comments(instance_id, section_key);

ALTER TABLE public.clm_section_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read section comments" ON public.clm_section_comments FOR SELECT
USING (EXISTS (SELECT 1 FROM public.clm_template_instances i WHERE i.id = instance_id
  AND (public.can_access_account_data(auth.uid(), i.account_id) OR public.is_recouply_admin(auth.uid()))));

CREATE POLICY "Insert section comments" ON public.clm_section_comments FOR INSERT
WITH CHECK (
  author_id = auth.uid() AND
  EXISTS (SELECT 1 FROM public.clm_template_instances i WHERE i.id = instance_id
    AND public.can_write_as_account(auth.uid(), i.account_id))
);

CREATE POLICY "Update own section comments" ON public.clm_section_comments FOR UPDATE
USING (author_id = auth.uid());

CREATE POLICY "Delete own section comments" ON public.clm_section_comments FOR DELETE
USING (author_id = auth.uid());

CREATE TRIGGER trg_clm_comments_updated BEFORE UPDATE ON public.clm_section_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for clm-templates bucket (private)
CREATE POLICY "CLM upload own files" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'clm-templates' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "CLM read own files" ON storage.objects FOR SELECT
USING (bucket_id = 'clm-templates' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "CLM update own files" ON storage.objects FOR UPDATE
USING (bucket_id = 'clm-templates' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "CLM delete own files" ON storage.objects FOR DELETE
USING (bucket_id = 'clm-templates' AND auth.uid()::text = (storage.foldername(name))[1]);
