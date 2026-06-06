
-- 1. Drop the contracts table policies that reference clm_entitlements
DROP POLICY IF EXISTS "Account members view contracts when CLM active" ON public.contracts;
DROP POLICY IF EXISTS "Account writers create contracts when CLM active" ON public.contracts;
DROP POLICY IF EXISTS "Account writers update contracts when CLM active" ON public.contracts;
DROP POLICY IF EXISTS "Account writers delete contracts when CLM active" ON public.contracts;

CREATE POLICY "Account members view contracts"
ON public.contracts FOR SELECT TO authenticated
USING (public.can_access_account_data(auth.uid(), account_id));

CREATE POLICY "Account writers create contracts"
ON public.contracts FOR INSERT TO authenticated
WITH CHECK (public.can_write_as_account(auth.uid(), account_id));

CREATE POLICY "Account writers update contracts"
ON public.contracts FOR UPDATE TO authenticated
USING (public.can_write_as_account(auth.uid(), account_id))
WITH CHECK (public.can_write_as_account(auth.uid(), account_id));

CREATE POLICY "Account writers delete contracts"
ON public.contracts FOR DELETE TO authenticated
USING (public.can_write_as_account(auth.uid(), account_id));

-- 2. Replace has_clm_access(uuid, uuid) without the entitlement join
CREATE OR REPLACE FUNCTION public.has_clm_access(_user_id uuid, _instance_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clm_template_instances ti
    WHERE ti.id = _instance_id
      AND (
        ti.account_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.account_users au
          WHERE au.user_id = _user_id
            AND au.account_id = ti.account_id
            AND au.status = 'active'
        )
        OR public.is_support_with_access(_user_id, ti.account_id)
      )
  );
$$;

-- 3. Drop the unused single-arg overload (security finding)
DROP FUNCTION IF EXISTS public.has_clm_access(uuid);

-- 4. Drop the clm_entitlements table and its admin hook artifacts
DROP TABLE IF EXISTS public.clm_entitlements CASCADE;
