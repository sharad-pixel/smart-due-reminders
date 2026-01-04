-- Clean up redundant RLS policies on profiles table
-- Remove duplicate admin policies that use {public} role and keep only {authenticated}

-- Drop redundant public role policies
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- The following policies remain:
-- "Recouply admins can update any profile" (authenticated) - KEEP
-- "Recouply admins can view all profiles" (authenticated) - KEEP
-- "Team members can view account owner profile" - KEEP
-- "Users can delete own profile" (authenticated) - KEEP
-- "Users can insert own profile" (authenticated) - KEEP
-- "Users can update own profile" (authenticated) - KEEP
-- "Users can view own profile" (authenticated) - KEEP

-- Verify no anonymous access exists by ensuring all policies are for authenticated role only
-- (already the case after removing the public role policies)