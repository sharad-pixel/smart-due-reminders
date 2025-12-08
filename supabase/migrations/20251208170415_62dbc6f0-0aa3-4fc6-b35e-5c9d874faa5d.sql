
-- Fix infinite recursion in account_users RLS policy
-- The issue: profiles RLS references account_users, and account_users RLS has self-referencing EXISTS clause

-- First, create a helper function to check team membership without causing recursion
-- Using SECURITY DEFINER to bypass RLS when checking membership
CREATE OR REPLACE FUNCTION public.is_team_member_of_account(p_user_id uuid, p_account_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM account_users
    WHERE user_id = p_user_id 
    AND account_id = p_account_id 
    AND status = 'active'
  );
$$;

-- Drop and recreate the account_users SELECT policy without self-reference
DROP POLICY IF EXISTS "Users can view team members of their accounts" ON public.account_users;

CREATE POLICY "Users can view team members of their accounts"
ON public.account_users
FOR SELECT
USING (
  -- Account owners can see all their team members
  account_id = auth.uid()
  -- Users can see their own record
  OR user_id = auth.uid()
  -- Account managers can see the team
  OR is_account_manager(auth.uid(), account_id)
);

-- Now update profiles policy to use the helper function instead
DROP POLICY IF EXISTS "Team members can view account owner profile" ON public.profiles;

CREATE POLICY "Team members can view account owner profile"
ON public.profiles
FOR SELECT
USING (
  is_team_member_of_account(auth.uid(), profiles.id)
);
