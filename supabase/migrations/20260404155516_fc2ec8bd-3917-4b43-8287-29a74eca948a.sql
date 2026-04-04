
-- Drop overly permissive policies that expose all tokens
DROP POLICY IF EXISTS "Allow public token verification" ON public.debtor_portal_tokens;
DROP POLICY IF EXISTS "Authenticated users can view tokens" ON public.debtor_portal_tokens;
DROP POLICY IF EXISTS "Deny anon token enumeration" ON public.debtor_portal_tokens;

-- Replace with restrictive policies: no client-side access at all
-- All token operations go through edge functions using service_role (which bypasses RLS)
CREATE POLICY "No anon access to tokens"
ON public.debtor_portal_tokens
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

CREATE POLICY "No authenticated access to tokens"
ON public.debtor_portal_tokens
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);
