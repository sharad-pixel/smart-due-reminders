
-- =========================================================
-- P0 #1: payment_plans — fix INSERT privilege escalation
-- =========================================================
DROP POLICY IF EXISTS "Users can create their own payment plans" ON public.payment_plans;

CREATE POLICY "Users can create their own payment plans"
ON public.payment_plans
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_account_data(auth.uid(), user_id));

-- =========================================================
-- P0 #2: pending_sheet_imports — fix INSERT privilege escalation
-- Keep service_role unrestricted; restrict authenticated users to their own data.
-- =========================================================
DROP POLICY IF EXISTS "Service role can insert pending imports" ON public.pending_sheet_imports;

CREATE POLICY "Service role can insert pending imports"
ON public.pending_sheet_imports
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Users can insert their own pending imports"
ON public.pending_sheet_imports
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR user_id = public.get_effective_account_id(auth.uid())
);

-- =========================================================
-- P0 #3: system_config — restrict public read, keep maintenance flag public
-- =========================================================
DROP POLICY IF EXISTS "Anyone can read system config" ON public.system_config;

-- Authenticated users can read all config keys
CREATE POLICY "Authenticated users can read system config"
ON public.system_config
FOR SELECT
TO authenticated
USING (true);

-- Public (anon) can only read the maintenance_mode flag — needed for the
-- pre-login maintenance gate. Everything else stays private.
CREATE POLICY "Public can read maintenance flag only"
ON public.system_config
FOR SELECT
TO anon
USING (key = 'maintenance_mode');
