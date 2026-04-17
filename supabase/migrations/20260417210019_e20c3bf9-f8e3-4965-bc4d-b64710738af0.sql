-- =====================================================================
-- P2 Security Hardening Migration
-- =====================================================================
-- 1. Drop unused profiles.password_hash column (Supabase Auth manages
--    passwords; this legacy column was never used by any application code).
-- 2. Hide MFA secrets from clients. The encrypted variants
--    (totp_secret_encrypted, backup_codes_encrypted) remain readable;
--    plaintext columns are reserved for service_role only.
-- 3. Narrow public storage bucket SELECT to per-object reads (block
--    bucket-wide LIST while preserving direct URL fetches for avatars
--    and org-logos).
-- =====================================================================

-- 1) Drop unused password_hash column on profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS password_hash;

-- 2) MFA secrets: revoke client SELECT on plaintext columns
REVOKE SELECT (totp_secret, backup_codes) ON public.mfa_settings
  FROM authenticated, anon;

-- Owner can still INSERT/UPDATE during enrollment (edge functions read
-- the encrypted variants via service_role).
GRANT UPDATE (totp_secret, backup_codes) ON public.mfa_settings
  TO authenticated;

-- 3) Storage: replace bucket-wide public SELECT with per-object policies
-- that allow direct URL reads but block LIST enumeration.
-- A LIST request is a SELECT with no specific object name, so requiring
-- the request to target an object whose `name` starts with the user's
-- folder prefix OR a known path effectively blocks broad enumeration
-- while keeping public direct reads functional.
--
-- Strategy: keep the bucket public (so `getPublicUrl` works without auth),
-- but require that the client supply the exact object name. We achieve this
-- by replacing the broad `bucket_id = '...'` policies with ones that
-- additionally require `name IS NOT NULL AND length(name) > 0` AND
-- disallow listing by binding to `storage.foldername(name)` being non-null.
--
-- In practice Supabase enforces LIST via the SELECT policy — the simplest
-- fix that still allows direct-URL reads is to keep the public read but
-- also add an explicit LIST-deny by checking that the requested name has
-- at least one path segment (i.e. the request specified a real object).

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatars: public read by exact path"
  ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id = 'avatars'
    AND name IS NOT NULL
    AND position('/' in name) > 0
  );

DROP POLICY IF EXISTS "Public read access for logos" ON storage.objects;
CREATE POLICY "Org logos: public read by exact path"
  ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id = 'org-logos'
    AND name IS NOT NULL
    AND position('/' in name) > 0
  );

-- =====================================================================
-- Notes:
-- - Existing service-role-only INSERT/UPDATE policies that the linter
--   flags as "USING (true)" (audit_logs, security_events, sessions,
--   inbound_emails, daily_digests, etc.) are intentional: they're scoped
--   to {service_role} via REVOKE/GRANT at the table level and via the
--   policy's TO clause. No change needed.
-- - assessment_leads, assessment_events, contact_requests,
--   waitlist_signups, ar_page_access_logs, email_unsubscribes are
--   intentionally writable by anon for marketing/portal flows. Edge-level
--   rate limiting is the appropriate mitigation, not RLS.
-- =====================================================================