
-- ============ drive_connections ============
DROP POLICY IF EXISTS "Users can manage own drive connections" ON public.drive_connections;

CREATE POLICY "Users can insert own drive connections"
  ON public.drive_connections FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own drive connections"
  ON public.drive_connections FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own drive connections"
  ON public.drive_connections FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE VIEW public.drive_connections_safe
WITH (security_invoker = true) AS
SELECT id, user_id, organization_id, provider, folder_id, folder_name,
       token_expires_at, last_sync_at, sync_frequency, is_active,
       created_at, updated_at
FROM public.drive_connections
WHERE user_id = auth.uid();

GRANT SELECT ON public.drive_connections_safe TO authenticated;

-- ============ email_accounts ============
DROP POLICY IF EXISTS "Users can view own email accounts" ON public.email_accounts;

CREATE OR REPLACE VIEW public.email_accounts_safe
WITH (security_invoker = true) AS
SELECT id, user_id, email_address, provider, display_name, auth_method,
       token_expires_at, smtp_host, smtp_port, smtp_username, smtp_use_tls,
       imap_host, imap_port, imap_username, imap_use_tls,
       is_active, is_verified, last_verified_at, last_successful_send,
       last_sync_at, dkim_status, spf_status, connection_status, error_message,
       created_at, updated_at, is_primary, email_type
FROM public.email_accounts
WHERE user_id = auth.uid();

GRANT SELECT ON public.email_accounts_safe TO authenticated;

-- ============ email_sending_profiles ============
DROP POLICY IF EXISTS "Users can view own email profiles" ON public.email_sending_profiles;

CREATE OR REPLACE VIEW public.email_sending_profiles_safe
WITH (security_invoker = true) AS
SELECT id, user_id, sender_name, sender_email, domain,
       spf_validated, dkim_validated, dmarc_validated, verification_status,
       use_recouply_domain, spf_record, dkim_record, return_path_record,
       dmarc_record, bounce_rate, spam_complaint_rate, domain_reputation,
       last_verified_at, is_active, created_at, updated_at
FROM public.email_sending_profiles
WHERE user_id = auth.uid();

GRANT SELECT ON public.email_sending_profiles_safe TO authenticated;

-- ============ user_secrets — explicit lockdown ============
REVOKE ALL ON public.user_secrets FROM anon, authenticated;
GRANT ALL ON public.user_secrets TO service_role;
COMMENT ON TABLE public.user_secrets IS
  'Service-role-only. Never expose to anon/authenticated. Access through dedicated edge functions.';

-- ============ login_attempts — block client writes ============
DROP POLICY IF EXISTS "Only service role can insert login attempts" ON public.login_attempts;
CREATE POLICY "Only service role can insert login attempts"
  ON public.login_attempts FOR INSERT TO service_role
  WITH CHECK (true);
REVOKE INSERT ON public.login_attempts FROM anon, authenticated;
