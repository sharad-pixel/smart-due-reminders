
-- Remove team member SELECT policy that exposes all columns including credentials
DROP POLICY IF EXISTS "Team members can view limited owner profile" ON public.profiles;
