
CREATE OR REPLACE VIEW public.profiles_team_safe
WITH (security_invoker = true) AS
SELECT 
  id, email, name, company_name, plan_type,
  subscription_status, created_at
FROM public.profiles;

DROP POLICY IF EXISTS "Team members can view account owner profile" ON public.profiles;

CREATE POLICY "Team members can view limited owner profile"
ON public.profiles FOR SELECT TO authenticated
USING (
  is_team_member_of_account(auth.uid(), id)
  AND id != auth.uid()
);
