
-- Fix campaign_outreach_emails: replace public ALL with authenticated admin policy
DROP POLICY IF EXISTS "Admins can manage campaign emails" ON public.campaign_outreach_emails;

CREATE POLICY "Admins can manage campaign emails"
ON public.campaign_outreach_emails FOR ALL TO authenticated
USING (is_recouply_admin(auth.uid()))
WITH CHECK (is_recouply_admin(auth.uid()));

-- Fix admin_user_actions: remove the overly permissive SELECT
DROP POLICY IF EXISTS "Admins can view all actions" ON public.admin_user_actions;
