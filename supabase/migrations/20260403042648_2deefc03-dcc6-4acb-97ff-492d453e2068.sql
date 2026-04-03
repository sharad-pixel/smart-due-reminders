
-- 1. Fix debtor_portal_tokens: deny anon, allow authenticated
DROP POLICY IF EXISTS "Deny public token enumeration" ON public.debtor_portal_tokens;
DROP POLICY IF EXISTS "Users can view own portal tokens" ON public.debtor_portal_tokens;

CREATE POLICY "Deny anon token enumeration"
ON public.debtor_portal_tokens FOR SELECT TO anon
USING (false);

CREATE POLICY "Authenticated users can view tokens"
ON public.debtor_portal_tokens FOR SELECT TO authenticated
USING (true);

-- 2. Fix payment_plans: deny anon
DROP POLICY IF EXISTS "Deny anon payment plan access" ON public.payment_plans;

CREATE POLICY "Deny anon payment plan access"
ON public.payment_plans FOR SELECT TO anon
USING (false);

-- 3. Fix payment_plan_installments: deny anon
DROP POLICY IF EXISTS "Deny anon installment access" ON public.payment_plan_installments;

CREATE POLICY "Deny anon installment access"
ON public.payment_plan_installments FOR SELECT TO anon
USING (false);

-- 4. Fix branding_settings: deny anon
DROP POLICY IF EXISTS "Deny anon branding access" ON public.branding_settings;

CREATE POLICY "Deny anon branding access"
ON public.branding_settings FOR SELECT TO anon
USING (false);

-- 5. Fix debtors: remove cross-account policy
DROP POLICY IF EXISTS "Authenticated can view debtors linked to public payment plans" ON public.debtors;

-- 6. Fix documents storage upload
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;

CREATE POLICY "Users can upload to own folder in documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
