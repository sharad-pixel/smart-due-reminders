-- Support Access Grants
CREATE TABLE public.support_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  granted_by uuid NOT NULL,
  scope text NOT NULL DEFAULT 'read' CHECK (scope IN ('read','write')),
  reason text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sag_account_active ON public.support_access_grants (account_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_sag_active_lookup ON public.support_access_grants (account_id) WHERE revoked_at IS NULL;

ALTER TABLE public.support_access_grants ENABLE ROW LEVEL SECURITY;

-- Enforce 30-day max duration
CREATE OR REPLACE FUNCTION public.validate_support_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.expires_at > now() + INTERVAL '30 days' THEN
    RAISE EXCEPTION 'Support access grants cannot exceed 30 days';
  END IF;
  IF NEW.expires_at <= now() THEN
    RAISE EXCEPTION 'Support access expiration must be in the future';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_support_grant
BEFORE INSERT ON public.support_access_grants
FOR EACH ROW EXECUTE FUNCTION public.validate_support_grant();

CREATE TRIGGER trg_sag_updated_at
BEFORE UPDATE ON public.support_access_grants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: active support access exists?
CREATE OR REPLACE FUNCTION public.has_active_support_access(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.support_access_grants
    WHERE account_id = p_account_id
      AND revoked_at IS NULL
      AND expires_at > now()
  );
$$;

-- Helper: is caller a recouply admin with active grant on this account?
CREATE OR REPLACE FUNCTION public.is_support_with_access(p_user_id uuid, p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_recouply_admin(p_user_id)
     AND public.has_active_support_access(p_account_id);
$$;

-- RLS policies for support_access_grants
CREATE POLICY "Account managers can view their grants"
ON public.support_access_grants FOR SELECT
TO authenticated
USING (
  is_account_manager(auth.uid(), account_id)
  OR account_id = auth.uid()
  OR is_recouply_admin(auth.uid())
);

CREATE POLICY "Account managers can create grants"
ON public.support_access_grants FOR INSERT
TO authenticated
WITH CHECK (
  (is_account_manager(auth.uid(), account_id) OR account_id = auth.uid())
  AND granted_by = auth.uid()
);

CREATE POLICY "Account managers can revoke grants"
ON public.support_access_grants FOR UPDATE
TO authenticated
USING (
  is_account_manager(auth.uid(), account_id)
  OR account_id = auth.uid()
  OR is_recouply_admin(auth.uid())
)
WITH CHECK (
  is_account_manager(auth.uid(), account_id)
  OR account_id = auth.uid()
  OR is_recouply_admin(auth.uid())
);

-- Support Access Log (audit trail)
CREATE TABLE public.support_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid REFERENCES public.support_access_grants(id) ON DELETE SET NULL,
  support_user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  action text NOT NULL,
  route text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sal_account ON public.support_access_log (account_id, created_at DESC);
CREATE INDEX idx_sal_grant ON public.support_access_log (grant_id);

ALTER TABLE public.support_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account managers and admins can view audit log"
ON public.support_access_log FOR SELECT
TO authenticated
USING (
  is_account_manager(auth.uid(), account_id)
  OR account_id = auth.uid()
  OR is_recouply_admin(auth.uid())
);

CREATE POLICY "Recouply admins can write audit log"
ON public.support_access_log FOR INSERT
TO authenticated
WITH CHECK (is_recouply_admin(auth.uid()) AND support_user_id = auth.uid());

-- Cleanup function (90-day retention)
CREATE OR REPLACE FUNCTION public.cleanup_support_access_log()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.support_access_log WHERE created_at < now() - INTERVAL '90 days';
$$;