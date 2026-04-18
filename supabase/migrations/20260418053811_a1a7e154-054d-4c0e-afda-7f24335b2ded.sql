-- 1. Drop existing user SELECT policies on crm_connections that expose tokens
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'crm_connections' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.crm_connections', pol.policyname);
  END LOOP;
END $$;

-- 2. Ensure RLS is enabled (no SELECT policy = no client reads, which is what we want)
ALTER TABLE public.crm_connections ENABLE ROW LEVEL SECURITY;

-- 3. Create a safe view exposing only non-sensitive fields
CREATE OR REPLACE VIEW public.crm_connections_safe
WITH (security_invoker = true)
AS
SELECT
  id,
  user_id,
  crm_type,
  instance_url,
  connected_at,
  last_sync_at,
  created_at,
  updated_at
FROM public.crm_connections
WHERE auth.uid() = user_id;

-- 4. Grant access to the safe view
GRANT SELECT ON public.crm_connections_safe TO authenticated;

-- 5. Revoke any direct table SELECT from anon/authenticated to be safe
REVOKE SELECT ON public.crm_connections FROM anon, authenticated;