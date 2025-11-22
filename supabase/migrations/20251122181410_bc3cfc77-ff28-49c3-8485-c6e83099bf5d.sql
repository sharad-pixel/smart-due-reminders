-- Fix infinite recursion in account_users RLS policy
DROP POLICY IF EXISTS "Users can view team members of their accounts" ON account_users;

-- Create a simpler policy without recursion
CREATE POLICY "Users can view team members of their accounts"
ON account_users
FOR SELECT
USING (
  account_id = auth.uid() 
  OR user_id = auth.uid()
  OR is_account_manager(auth.uid(), account_id)
);