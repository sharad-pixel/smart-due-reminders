-- ===== P3: Credential exposure hardening =====

-- 1) PROFILES: remove the broad admin SELECT policy on the raw table.
--    Admins must read profile data via the existing profiles_admin_safe view,
--    which excludes all credential columns. This prevents a compromised admin
--    account from reading quickbooks/sendgrid/twilio/smtp tokens.
DROP POLICY IF EXISTS "Recouply admins can view all profiles" ON public.profiles;

-- Ensure the safe view is readable by authenticated users (admins use it,
-- and existing queries already join against it for sales_rep_user_id, etc.).
GRANT SELECT ON public.profiles_admin_safe TO authenticated;

-- profiles_team_safe is the parallel view for team-member visibility.
GRANT SELECT ON public.profiles_team_safe TO authenticated;

-- 2) CRM_CONNECTIONS: revoke client SELECT on plaintext OAuth tokens.
--    Edge functions (service_role) bypass column GRANTs and continue to work.
--    Authenticated clients can still see connection metadata (crm_type,
--    instance_url, connected_at, last_sync_at) but never the raw tokens.
REVOKE SELECT (access_token, refresh_token) ON public.crm_connections FROM authenticated;
REVOKE SELECT (access_token, refresh_token) ON public.crm_connections FROM anon;

-- Make sure the rest of the columns remain selectable for owners.
GRANT SELECT (
  id, user_id, crm_type, instance_url, connected_at,
  last_sync_at, created_at, updated_at
) ON public.crm_connections TO authenticated;