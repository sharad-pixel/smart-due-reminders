
-- Add approver assignment to revisions
ALTER TABLE public.clm_section_revisions
  ADD COLUMN IF NOT EXISTS assigned_approver_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_approver_email text,
  ADD COLUMN IF NOT EXISTS assigned_approver_name text,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

-- External CLM portal access tokens
CREATE TABLE IF NOT EXISTS public.clm_external_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id uuid NOT NULL REFERENCES public.clm_template_instances(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  debtor_id uuid,
  email text NOT NULL,
  name text,
  role text NOT NULL DEFAULT 'reviewer', -- reviewer | approver | viewer | signer
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clm_external_access_instance ON public.clm_external_access(instance_id);
CREATE INDEX IF NOT EXISTS idx_clm_external_access_email ON public.clm_external_access(lower(email));
CREATE INDEX IF NOT EXISTS idx_clm_external_access_token ON public.clm_external_access(token);

ALTER TABLE public.clm_external_access ENABLE ROW LEVEL SECURITY;

-- Account members can manage tokens for their workspaces
CREATE POLICY "Account members manage clm external access"
  ON public.clm_external_access
  FOR ALL
  TO authenticated
  USING (public.can_access_account_data(auth.uid(), account_id))
  WITH CHECK (public.can_write_as_account(auth.uid(), account_id));

-- No anon SELECT — portal goes through SECURITY DEFINER edge function

CREATE TRIGGER update_clm_external_access_updated_at
  BEFORE UPDATE ON public.clm_external_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
