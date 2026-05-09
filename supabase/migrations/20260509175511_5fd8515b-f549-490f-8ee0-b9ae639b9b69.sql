
-- 1) Engagement profile (one per workspace)
CREATE TABLE IF NOT EXISTS public.clm_engagement_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL UNIQUE REFERENCES public.clm_template_instances(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  customer_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  industries TEXT[] NOT NULL DEFAULT '{}',
  engagement_type TEXT,
  business_model TEXT,
  risk_level TEXT NOT NULL DEFAULT 'low',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clm_workspace_required_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.clm_template_instances(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'recommended',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clm_workspace_compliance_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.clm_template_instances(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  requirement_key TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'required',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clm_workspace_approval_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.clm_template_instances(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  approver_role TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT true,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clm_eng_profiles_instance ON public.clm_engagement_profiles(instance_id);
CREATE INDEX IF NOT EXISTS idx_clm_req_docs_instance ON public.clm_workspace_required_documents(instance_id);
CREATE INDEX IF NOT EXISTS idx_clm_compliance_instance ON public.clm_workspace_compliance_requirements(instance_id);
CREATE INDEX IF NOT EXISTS idx_clm_approval_routing_instance ON public.clm_workspace_approval_routing(instance_id);

ALTER TABLE public.clm_engagement_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clm_workspace_required_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clm_workspace_compliance_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clm_workspace_approval_routing ENABLE ROW LEVEL SECURITY;

-- Reusable policy pattern: account-scoped via can_access_account_data + admin bypass.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'clm_engagement_profiles',
    'clm_workspace_required_documents',
    'clm_workspace_compliance_requirements',
    'clm_workspace_approval_routing'
  ]) LOOP
    EXECUTE format($pol$
      CREATE POLICY "Read %1$s"
      ON public.%1$I
      FOR SELECT
      USING (can_access_account_data(auth.uid(), account_id) OR is_recouply_admin(auth.uid()));
    $pol$, t);

    EXECUTE format($pol$
      CREATE POLICY "Insert %1$s"
      ON public.%1$I
      FOR INSERT
      WITH CHECK (can_access_account_data(auth.uid(), account_id) OR is_recouply_admin(auth.uid()));
    $pol$, t);

    EXECUTE format($pol$
      CREATE POLICY "Update %1$s"
      ON public.%1$I
      FOR UPDATE
      USING (can_access_account_data(auth.uid(), account_id) OR is_recouply_admin(auth.uid()));
    $pol$, t);

    EXECUTE format($pol$
      CREATE POLICY "Delete %1$s"
      ON public.%1$I
      FOR DELETE
      USING (can_access_account_data(auth.uid(), account_id) OR is_recouply_admin(auth.uid()));
    $pol$, t);
  END LOOP;
END$$;

-- updated_at trigger for engagement profiles
CREATE TRIGGER update_clm_engagement_profiles_updated_at
BEFORE UPDATE ON public.clm_engagement_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
