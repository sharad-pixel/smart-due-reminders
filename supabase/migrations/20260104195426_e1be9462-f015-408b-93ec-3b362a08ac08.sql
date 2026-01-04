-- Fix Team members policy to use authenticated role instead of public
DROP POLICY IF EXISTS "Team members can view account owner profile" ON public.profiles;

CREATE POLICY "Team members can view account owner profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_team_member_of_account(auth.uid(), id));