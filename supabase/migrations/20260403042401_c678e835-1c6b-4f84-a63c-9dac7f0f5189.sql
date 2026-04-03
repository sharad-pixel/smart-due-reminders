
-- 1. Fix lead_campaign_progress: drop the permissive service role policy with USING(true)
DROP POLICY IF EXISTS "Service role can manage lead progress" ON public.lead_campaign_progress;

-- Add a proper service-role-only policy (service_role bypasses RLS anyway, so this is just cleanup)
-- The admin policy already exists and is correct.

-- 2. Fix debtors: the anon payment plan policy is fine for public AR pages, but restrict to authenticated
DROP POLICY IF EXISTS "Anon can view debtors linked to public payment plans" ON public.debtors;

CREATE POLICY "Authenticated can view debtors linked to public payment plans"
ON public.debtors FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM payment_plans pp
    WHERE pp.debtor_id = debtors.id AND pp.public_token IS NOT NULL
  )
);

-- 3. Fix documents bucket: set to private
UPDATE storage.buckets SET public = false WHERE id = 'documents';

-- 4. Fix profiles: add explicit anon deny (defense in depth)
-- Profiles already has authenticated-only policies, but let's be explicit
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Deny anonymous access to profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "Deny anonymous access to profiles" ON public.profiles FOR SELECT TO anon USING (false)';
  END IF;
END $$;
