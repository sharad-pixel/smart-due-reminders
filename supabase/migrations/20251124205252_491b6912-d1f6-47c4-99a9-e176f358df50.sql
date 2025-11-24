-- Fix Security Issues: Profiles, Debtors, and Marketing Snippets RLS Policies

-- 1. FIX PROFILES TABLE RLS POLICIES
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create secure policies that properly verify ownership
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_recouply_admin(auth.uid()));

CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (is_recouply_admin(auth.uid()));

-- 2. ADD ADDITIONAL VALIDATION FOR DEBTORS TABLE
-- Add index for better performance on user_id lookups
CREATE INDEX IF NOT EXISTS idx_debtors_user_id ON public.debtors(user_id);

-- 3. FIX MARKETING_SNIPPETS - RESTRICT WRITES TO ADMIN ONLY
DROP POLICY IF EXISTS "Authenticated users can insert marketing snippets" ON public.marketing_snippets;
DROP POLICY IF EXISTS "Authenticated users can update marketing snippets" ON public.marketing_snippets;

-- Only admins can insert/update marketing content
CREATE POLICY "Admins can insert marketing snippets"
ON public.marketing_snippets
FOR INSERT
WITH CHECK (is_recouply_admin(auth.uid()));

CREATE POLICY "Admins can update marketing snippets"
ON public.marketing_snippets
FOR UPDATE
USING (is_recouply_admin(auth.uid()));

CREATE POLICY "Admins can delete marketing snippets"
ON public.marketing_snippets
FOR DELETE
USING (is_recouply_admin(auth.uid()));

-- Keep public read access (this is intentional for marketing content)
-- "Marketing snippets are viewable by everyone" policy remains unchanged

-- 4. ADD SECURITY COMMENTS FOR DOCUMENTATION
COMMENT ON TABLE public.profiles IS 'User profiles with strict RLS - users can only access their own profile, admins can access all';
COMMENT ON TABLE public.debtors IS 'Debtor records with user isolation - each user can only access their own debtors';
COMMENT ON TABLE public.marketing_snippets IS 'Marketing content - publicly readable, admin-only writes';