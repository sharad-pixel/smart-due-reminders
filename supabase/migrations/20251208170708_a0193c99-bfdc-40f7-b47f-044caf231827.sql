
-- Fix account_users RLS policy to allow team members to see other team members
-- Use the security definer function to avoid infinite recursion

DROP POLICY IF EXISTS "Users can view team members of their accounts" ON public.account_users;

CREATE POLICY "Users can view team members of their accounts"
ON public.account_users
FOR SELECT
USING (
  -- Account owners can see all their team members (their account_id equals owner's user_id)
  account_id = auth.uid()
  -- Users can see their own record
  OR user_id = auth.uid()
  -- Account managers (owner/admin) can see the team
  OR is_account_manager(auth.uid(), account_id)
  -- Team members can see other team members in the same account (using security definer function)
  OR is_team_member_of_account(auth.uid(), account_id)
);
