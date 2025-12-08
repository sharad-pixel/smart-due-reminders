-- Drop the existing SELECT policy and replace with a more inclusive one
DROP POLICY IF EXISTS "Users can view team members of their accounts" ON public.account_users;

-- Create new policy that allows team members to see all members of their account
CREATE POLICY "Users can view team members of their accounts"
ON public.account_users
FOR SELECT
USING (
  -- Account owner can see all their team members
  account_id = auth.uid()
  OR 
  -- User can see their own record
  user_id = auth.uid()
  OR 
  -- Account managers (owner/admin) can see team
  is_account_manager(auth.uid(), account_id)
  OR
  -- Team members can see other team members in the same account
  EXISTS (
    SELECT 1 FROM account_users au
    WHERE au.user_id = auth.uid()
      AND au.account_id = account_users.account_id
      AND au.status = 'active'
  )
);