-- 1. Drop password_hash column
ALTER TABLE public.profiles DROP COLUMN IF EXISTS password_hash;

-- 2. Revoke direct read access to sensitive credential columns
REVOKE SELECT (
  quickbooks_access_token,
  quickbooks_refresh_token,
  quickbooks_token_expires_at,
  sendgrid_api_key,
  twilio_auth_token,
  twilio_account_sid,
  smtp_settings,
  address_autocomplete_api_key,
  email_verification_token,
  email_verification_token_expires_at
) ON public.profiles FROM authenticated, anon;

-- 3. Drop overly broad admin SELECT policies on profiles
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND cmd = 'SELECT'
      AND (policyname ILIKE '%admin%' OR policyname ILIKE '%recouply%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- 4. Drop dependent views first
DROP VIEW IF EXISTS public.profiles_admin_safe CASCADE;

-- 5. Recreate admin-safe view dynamically excluding credential columns
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
    CREATE VIEW public.profiles_admin_safe AS
    SELECT %s
    FROM public.profiles p
    WHERE public.is_recouply_admin(auth.uid()) = true
  $f$, v_cols);
END $$;

GRANT SELECT ON public.profiles_admin_safe TO authenticated;