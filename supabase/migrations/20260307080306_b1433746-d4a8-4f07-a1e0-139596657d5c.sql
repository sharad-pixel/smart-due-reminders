-- FIX 1: Debtors table - restrict public SELECT and INSERT policies

DROP POLICY IF EXISTS "Public can view debtors for public payment plans" ON public.debtors;
CREATE POLICY "Anon can view debtors linked to public payment plans"
ON public.debtors FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM payment_plans pp
    WHERE pp.debtor_id = debtors.id
      AND pp.public_token IS NOT NULL
  )
);

DROP POLICY IF EXISTS "Users can create own debtors" ON public.debtors;
DROP POLICY IF EXISTS "Users can insert debtors to own or team account" ON public.debtors;
CREATE POLICY "Authenticated users can insert debtors"
ON public.debtors FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own and team debtors" ON public.debtors;
CREATE POLICY "Authenticated users can view own and team debtors"
ON public.debtors FOR SELECT TO authenticated
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can update own and team debtors" ON public.debtors;
CREATE POLICY "Authenticated users can update own and team debtors"
ON public.debtors FOR UPDATE TO authenticated
USING (can_access_account_data(auth.uid(), user_id))
WITH CHECK (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own and team debtors" ON public.debtors;
CREATE POLICY "Authenticated users can delete own and team debtors"
ON public.debtors FOR DELETE TO authenticated
USING (can_access_account_data(auth.uid(), user_id));

-- FIX 2: lead_campaign_progress - restrict to service_role and platform admins

DROP POLICY IF EXISTS "Admins can manage lead progress" ON public.lead_campaign_progress;

CREATE POLICY "Service role can manage lead progress"
ON public.lead_campaign_progress FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Platform admins can manage lead progress"
ON public.lead_campaign_progress FOR ALL TO authenticated
USING (public.is_recouply_admin(auth.uid()))
WITH CHECK (public.is_recouply_admin(auth.uid()));

-- FIX 3: debtor_contact_emails view - add security_invoker

CREATE OR REPLACE VIEW public.debtor_contact_emails
WITH (security_invoker = true)
AS
SELECT DISTINCT
  d.id as debtor_id,
  d.user_id,
  c.email
FROM public.debtors d
JOIN public.contacts c ON c.debtor_id = d.id
WHERE c.email IS NOT NULL AND c.email != '';