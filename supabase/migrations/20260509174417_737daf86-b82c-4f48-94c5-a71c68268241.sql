-- 1. Templates: industry + document type
ALTER TABLE public.clm_templates
  ADD COLUMN IF NOT EXISTS industry_category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS document_type text;

CREATE INDEX IF NOT EXISTS idx_clm_templates_industry
  ON public.clm_templates (industry_category);

-- 2. Workspaces: business profile + document state
ALTER TABLE public.clm_template_instances
  ADD COLUMN IF NOT EXISTS business_profile text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS profile_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS document_state text NOT NULL DEFAULT 'official';

-- 3. Document versions lifecycle
ALTER TABLE public.clm_document_versions
  ADD COLUMN IF NOT EXISTS lifecycle_label text NOT NULL DEFAULT 'internal_draft',
  ADD COLUMN IF NOT EXISTS source_of_changes text NOT NULL DEFAULT 'internal_edit',
  ADD COLUMN IF NOT EXISTS shared_externally boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signed_sealed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sealed_at timestamptz;

-- Immutability trigger: once signed_sealed, block updates (except unsealing flag toggles by service role)
CREATE OR REPLACE FUNCTION public.clm_block_sealed_version_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.signed_sealed = true THEN
    RAISE EXCEPTION 'Signed/sealed document versions are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clm_versions_immutable ON public.clm_document_versions;
CREATE TRIGGER trg_clm_versions_immutable
  BEFORE UPDATE ON public.clm_document_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.clm_block_sealed_version_update();

-- 4. Section revisions: visibility + assigned reviewer + counter text
ALTER TABLE public.clm_section_revisions
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'internal_only',
  ADD COLUMN IF NOT EXISTS counter_proposed_text text,
  ADD COLUMN IF NOT EXISTS suggested_by_external boolean NOT NULL DEFAULT false;

-- 5. Uploaded redlines / customer paper
CREATE TABLE IF NOT EXISTS public.clm_uploaded_redlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  instance_id uuid NOT NULL REFERENCES public.clm_template_instances(id) ON DELETE CASCADE,
  uploaded_by uuid,
  uploaded_by_name text,
  uploaded_by_email text,
  source text NOT NULL DEFAULT 'internal',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size_bytes integer,
  notes text,
  status text NOT NULL DEFAULT 'pending_review',
  linked_version_id uuid REFERENCES public.clm_document_versions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clm_redlines_instance ON public.clm_uploaded_redlines(instance_id);

ALTER TABLE public.clm_uploaded_redlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members read redlines"
  ON public.clm_uploaded_redlines FOR SELECT
  USING (can_access_account_data(auth.uid(), account_id) OR is_recouply_admin(auth.uid()));

CREATE POLICY "Account members insert redlines"
  ON public.clm_uploaded_redlines FOR INSERT
  WITH CHECK (can_write_as_account(auth.uid(), account_id));

CREATE POLICY "Account members update redlines"
  ON public.clm_uploaded_redlines FOR UPDATE
  USING (can_write_as_account(auth.uid(), account_id));

CREATE POLICY "Account members delete redlines"
  ON public.clm_uploaded_redlines FOR DELETE
  USING (can_write_as_account(auth.uid(), account_id));

CREATE TRIGGER trg_clm_redlines_updated
  BEFORE UPDATE ON public.clm_uploaded_redlines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Approval rules
CREATE TABLE IF NOT EXISTS public.clm_approval_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  business_profile text NOT NULL DEFAULT 'general',
  name text NOT NULL,
  description text,
  trigger jsonb NOT NULL DEFAULT '{}'::jsonb,
  required_roles text[] NOT NULL DEFAULT ARRAY['Legal']::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clm_approval_rules_account
  ON public.clm_approval_rules(account_id, business_profile);

ALTER TABLE public.clm_approval_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members read approval rules"
  ON public.clm_approval_rules FOR SELECT
  USING (can_access_account_data(auth.uid(), account_id) OR is_recouply_admin(auth.uid()));

CREATE POLICY "Account members insert approval rules"
  ON public.clm_approval_rules FOR INSERT
  WITH CHECK (can_write_as_account(auth.uid(), account_id) AND created_by = auth.uid());

CREATE POLICY "Account members update approval rules"
  ON public.clm_approval_rules FOR UPDATE
  USING (can_write_as_account(auth.uid(), account_id));

CREATE POLICY "Account members delete approval rules"
  ON public.clm_approval_rules FOR DELETE
  USING (can_write_as_account(auth.uid(), account_id));

CREATE TRIGGER trg_clm_approval_rules_updated
  BEFORE UPDATE ON public.clm_approval_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Approval requests (per version)
CREATE TABLE IF NOT EXISTS public.clm_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  instance_id uuid NOT NULL REFERENCES public.clm_template_instances(id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.clm_document_versions(id) ON DELETE SET NULL,
  rule_id uuid REFERENCES public.clm_approval_rules(id) ON DELETE SET NULL,
  required_role text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  decided_by uuid,
  decided_by_name text,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clm_approval_requests_instance
  ON public.clm_approval_requests(instance_id);
CREATE INDEX IF NOT EXISTS idx_clm_approval_requests_status
  ON public.clm_approval_requests(status);

ALTER TABLE public.clm_approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members read approval requests"
  ON public.clm_approval_requests FOR SELECT
  USING (can_access_account_data(auth.uid(), account_id) OR is_recouply_admin(auth.uid()));

CREATE POLICY "Account members insert approval requests"
  ON public.clm_approval_requests FOR INSERT
  WITH CHECK (can_write_as_account(auth.uid(), account_id));

CREATE POLICY "Account members update approval requests"
  ON public.clm_approval_requests FOR UPDATE
  USING (can_write_as_account(auth.uid(), account_id));

CREATE POLICY "Account members delete approval requests"
  ON public.clm_approval_requests FOR DELETE
  USING (can_write_as_account(auth.uid(), account_id));

CREATE TRIGGER trg_clm_approval_requests_updated
  BEFORE UPDATE ON public.clm_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();