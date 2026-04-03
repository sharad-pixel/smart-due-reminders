
-- Admin-controlled integration toggles
-- Scoped to account owner (parent), applies to entire hierarchy
CREATE TABLE public.integration_toggles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  integration_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  enabled_by UUID,
  enabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, integration_key)
);

ALTER TABLE public.integration_toggles ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage all toggles
CREATE POLICY "admins_manage_integration_toggles"
  ON public.integration_toggles
  FOR ALL
  TO authenticated
  USING (public.is_recouply_admin(auth.uid()))
  WITH CHECK (public.is_recouply_admin(auth.uid()));

-- Account owners and team members can read their own toggles
CREATE POLICY "users_read_own_integration_toggles"
  ON public.integration_toggles
  FOR SELECT
  TO authenticated
  USING (account_id = public.get_effective_account_id(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_integration_toggles_updated_at
  BEFORE UPDATE ON public.integration_toggles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
