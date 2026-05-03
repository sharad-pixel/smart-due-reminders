-- Support team assignment: admins assign which support users handle which account grants
CREATE TABLE IF NOT EXISTS public.support_access_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid NOT NULL REFERENCES public.support_access_grants(id) ON DELETE CASCADE,
  support_user_id uuid NOT NULL REFERENCES public.support_users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  UNIQUE (grant_id, support_user_id)
);

CREATE INDEX IF NOT EXISTS idx_support_assignments_grant ON public.support_access_assignments(grant_id);
CREATE INDEX IF NOT EXISTS idx_support_assignments_user ON public.support_access_assignments(support_user_id);

ALTER TABLE public.support_access_assignments ENABLE ROW LEVEL SECURITY;

-- Admins can fully manage
CREATE POLICY "Admins manage support assignments"
ON public.support_access_assignments
FOR ALL
TO authenticated
USING (public.is_recouply_admin(auth.uid()))
WITH CHECK (public.is_recouply_admin(auth.uid()));

-- Support users can view their own assignments
CREATE POLICY "Support users view own assignments"
ON public.support_access_assignments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_users su
    WHERE su.id = support_user_id AND su.auth_user_id = auth.uid()
  )
);

-- Helper: check whether a support user is assigned to a particular account's active grant
CREATE OR REPLACE FUNCTION public.is_assigned_support_for_account(p_user_id uuid, p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.support_access_assignments a
    JOIN public.support_users su ON su.id = a.support_user_id AND su.auth_user_id = p_user_id AND su.is_active
    JOIN public.support_access_grants g ON g.id = a.grant_id
    WHERE g.account_id = p_account_id
      AND g.revoked_at IS NULL
      AND g.expires_at > now()
  );
$$;

REVOKE ALL ON FUNCTION public.is_assigned_support_for_account(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_assigned_support_for_account(uuid, uuid) TO authenticated, service_role;