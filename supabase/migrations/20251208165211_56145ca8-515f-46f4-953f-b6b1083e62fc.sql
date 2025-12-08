-- Allow team members to view their account owner's profile
CREATE POLICY "Team members can view account owner profile"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM account_users
    WHERE account_users.user_id = auth.uid()
      AND account_users.account_id = profiles.id
      AND account_users.status = 'active'
  )
);