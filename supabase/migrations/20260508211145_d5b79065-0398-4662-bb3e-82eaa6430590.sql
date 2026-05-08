CREATE TABLE IF NOT EXISTS public.clm_instance_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.clm_template_instances(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  ai_summary TEXT,
  risk_flags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clm_instance_sections_instance ON public.clm_instance_sections(instance_id, order_index);

ALTER TABLE public.clm_instance_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read instance sections"
ON public.clm_instance_sections FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.clm_template_instances i
  WHERE i.id = clm_instance_sections.instance_id
    AND (public.can_access_account_data(auth.uid(), i.account_id) OR public.is_recouply_admin(auth.uid()))
));

CREATE POLICY "Insert instance sections"
ON public.clm_instance_sections FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.clm_template_instances i
  WHERE i.id = clm_instance_sections.instance_id
    AND public.can_write_as_account(auth.uid(), i.account_id)
));

CREATE POLICY "Update instance sections"
ON public.clm_instance_sections FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.clm_template_instances i
  WHERE i.id = clm_instance_sections.instance_id
    AND public.can_write_as_account(auth.uid(), i.account_id)
));

CREATE POLICY "Delete instance sections"
ON public.clm_instance_sections FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.clm_template_instances i
  WHERE i.id = clm_instance_sections.instance_id
    AND public.can_write_as_account(auth.uid(), i.account_id)
));

CREATE TRIGGER trg_clm_instance_sections_updated_at
BEFORE UPDATE ON public.clm_instance_sections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
DECLARE fk_name text;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'public.clm_template_instances'::regclass
    AND contype = 'f'
    AND conkey = ARRAY[(
      SELECT attnum FROM pg_attribute
      WHERE attrelid = 'public.clm_template_instances'::regclass
        AND attname = 'template_id'
    )];
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.clm_template_instances DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE public.clm_template_instances ALTER COLUMN template_id DROP NOT NULL;

ALTER TABLE public.clm_template_instances
  ADD CONSTRAINT clm_template_instances_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.clm_templates(id) ON DELETE SET NULL;

ALTER TABLE public.clm_template_instances
  ADD COLUMN IF NOT EXISTS template_name_snapshot TEXT;