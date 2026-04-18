-- Recreate admin-safe view with security_invoker so the view runs with caller's permissions
DROP VIEW IF EXISTS public.profiles_admin_safe CASCADE;

DO $$
DECLARE
  v_cols text;
  v_excluded text[] := ARRAY[
    'quickbooks_access_token',
    'quickbooks_refresh_token',
    'quickbooks_token_expires_at',
    'sendgrid_api_key',
    'twilio_auth_token',
    'twilio_account_sid',
    'smtp_settings',
    'address_autocomplete_api_key',
    'email_verification_token',
    'email_verification_token_expires_at'
  ];
BEGIN
  SELECT string_agg(format('p.%I', column_name), ', ' ORDER BY ordinal_position)
  INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name <> ALL(v_excluded);

  EXECUTE format($f$
    CREATE VIEW public.profiles_admin_safe
    WITH (security_invoker = true)
    AS
    SELECT %s
    FROM public.profiles p
    WHERE public.is_recouply_admin(auth.uid()) = true
  $f$, v_cols);
END $$;

GRANT SELECT ON public.profiles_admin_safe TO authenticated;

-- Add an admin SELECT policy on profiles (column-level REVOKE still blocks credential reads)
CREATE POLICY "Admins can view non-credential profile fields"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_recouply_admin(auth.uid()) = true);