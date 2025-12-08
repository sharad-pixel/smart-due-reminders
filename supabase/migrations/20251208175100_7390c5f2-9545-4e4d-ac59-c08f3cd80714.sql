-- ============================================
-- ORGANIZATIONS ENHANCEMENT MIGRATION
-- ============================================

-- 1. Add missing columns to organizations if needed
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#000000';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#6366f1';

-- Create unique constraint on owner if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_owner_user_id_key'
  ) THEN
    ALTER TABLE public.organizations ADD CONSTRAINT organizations_owner_user_id_key UNIQUE (owner_user_id);
  END IF;
END $$;

-- Enable RLS if not enabled
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON public.organizations(owner_user_id);

-- 2. Add organization_id to key tables
ALTER TABLE public.debtors ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.collection_tasks ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.collection_activities ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.ai_drafts ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.daily_digests ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.account_users ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.branding_settings ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_debtors_org ON public.debtors(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON public.invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_org ON public.documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org ON public.collection_tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_activities_org ON public.collection_activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_drafts_org ON public.ai_drafts(organization_id);
CREATE INDEX IF NOT EXISTS idx_account_users_org ON public.account_users(organization_id);

-- 3. Create organizations for existing users
INSERT INTO public.organizations (owner_user_id, name)
SELECT p.id, COALESCE(p.company_name, p.name, p.email, 'My Organization')
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.organizations o WHERE o.owner_user_id = p.id
)
ON CONFLICT (owner_user_id) DO NOTHING;

-- 4. Migrate existing data to organization_id
UPDATE public.debtors d
SET organization_id = o.id
FROM public.organizations o
WHERE d.user_id = o.owner_user_id AND d.organization_id IS NULL;

UPDATE public.invoices i
SET organization_id = o.id
FROM public.organizations o
WHERE i.user_id = o.owner_user_id AND i.organization_id IS NULL;

UPDATE public.documents doc
SET organization_id = o.id
FROM public.organizations o
WHERE doc.uploaded_by_user_id = o.owner_user_id AND doc.organization_id IS NULL;

UPDATE public.collection_tasks t
SET organization_id = o.id
FROM public.organizations o
WHERE t.user_id = o.owner_user_id AND t.organization_id IS NULL;

UPDATE public.collection_activities a
SET organization_id = o.id
FROM public.organizations o
WHERE a.user_id = o.owner_user_id AND a.organization_id IS NULL;

UPDATE public.ai_drafts d
SET organization_id = o.id
FROM public.organizations o
WHERE d.user_id = o.owner_user_id AND d.organization_id IS NULL;

UPDATE public.branding_settings bs
SET organization_id = o.id
FROM public.organizations o
WHERE bs.user_id = o.owner_user_id AND bs.organization_id IS NULL;

UPDATE public.account_users au
SET organization_id = o.id
FROM public.organizations o
WHERE au.account_id = o.owner_user_id AND au.organization_id IS NULL;

-- 5. Create helper functions
CREATE OR REPLACE FUNCTION public.get_user_organization_id(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE owner_user_id = p_user_id;
  IF v_org_id IS NOT NULL THEN RETURN v_org_id; END IF;
  
  SELECT organization_id INTO v_org_id
  FROM account_users
  WHERE user_id = p_user_id AND status = 'active' AND organization_id IS NOT NULL
  ORDER BY accepted_at DESC LIMIT 1;
  
  RETURN v_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_organization(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM organizations WHERE id = p_org_id AND owner_user_id = p_user_id) THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM account_users
    WHERE user_id = p_user_id AND organization_id = p_org_id AND status = 'active'
  );
END;
$$;

-- 6. Auto-create organization on new profile
CREATE OR REPLACE FUNCTION public.create_user_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO organizations (owner_user_id, name)
  VALUES (NEW.id, COALESCE(NEW.company_name, NEW.name, NEW.email, 'My Organization'))
  ON CONFLICT (owner_user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_create_org ON public.profiles;
CREATE TRIGGER on_profile_created_create_org
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_user_organization();

-- 7. RLS Policies for organizations
DROP POLICY IF EXISTS "Users can view own organization" ON public.organizations;
CREATE POLICY "Users can view own organization"
  ON public.organizations FOR SELECT
  USING (owner_user_id = auth.uid() OR can_access_organization(auth.uid(), id));

DROP POLICY IF EXISTS "Owners can update own organization" ON public.organizations;
CREATE POLICY "Owners can update own organization"
  ON public.organizations FOR UPDATE
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert organizations" ON public.organizations;
CREATE POLICY "System can insert organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

-- 8. Update document policies
DROP POLICY IF EXISTS "Users can view user owned documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert user owned documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update user owned documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete user owned documents" ON public.documents;
DROP POLICY IF EXISTS "Users can view own or org documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert own or org documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own or org documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete own or org documents" ON public.documents;

CREATE POLICY "Users can view own or org documents"
  ON public.documents FOR SELECT
  USING (uploaded_by_user_id = auth.uid() OR can_access_organization(auth.uid(), organization_id));

CREATE POLICY "Users can insert own documents"
  ON public.documents FOR INSERT
  WITH CHECK (uploaded_by_user_id = auth.uid());

CREATE POLICY "Users can update own or org documents"
  ON public.documents FOR UPDATE
  USING (uploaded_by_user_id = auth.uid() OR can_access_organization(auth.uid(), organization_id));

CREATE POLICY "Users can delete own or org documents"
  ON public.documents FOR DELETE
  USING (uploaded_by_user_id = auth.uid() OR can_access_organization(auth.uid(), organization_id));