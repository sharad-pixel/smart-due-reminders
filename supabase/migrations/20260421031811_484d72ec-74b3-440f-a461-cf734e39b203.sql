-- 1) Remove over-permissive public branding policy. Public payment plan page already
--    uses get_payment_plan_by_token() RPC which returns only safe branding fields.
DROP POLICY IF EXISTS "Public can view branding for public payment plans" ON public.branding_settings;

-- 2) Remove admin full-row SELECT policy on profiles. Admins must use the
--    profiles_admin_safe view, which excludes credentials and secrets.
DROP POLICY IF EXISTS "Admins can view non-credential profile fields" ON public.profiles;

-- 3) Lock down waitlist_signups: explicit admin-only read/manage, default-deny otherwise.
ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view waitlist signups" ON public.waitlist_signups;
CREATE POLICY "Admins can view waitlist signups"
ON public.waitlist_signups
FOR SELECT
TO authenticated
USING (public.is_recouply_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update waitlist signups" ON public.waitlist_signups;
CREATE POLICY "Admins can update waitlist signups"
ON public.waitlist_signups
FOR UPDATE
TO authenticated
USING (public.is_recouply_admin(auth.uid()))
WITH CHECK (public.is_recouply_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete waitlist signups" ON public.waitlist_signups;
CREATE POLICY "Admins can delete waitlist signups"
ON public.waitlist_signups
FOR DELETE
TO authenticated
USING (public.is_recouply_admin(auth.uid()));