
-- user_secrets: add explicit owner-scoped policies
CREATE POLICY "Users select own secrets" ON public.user_secrets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own secrets" ON public.user_secrets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own secrets" ON public.user_secrets
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own secrets" ON public.user_secrets
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Explicit SELECT policies
CREATE POLICY "Users view own CRM connections" ON public.crm_connections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users view own drive connections" ON public.drive_connections
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users view own email accounts" ON public.email_accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Drop plaintext MFA columns
ALTER TABLE public.mfa_settings DROP COLUMN IF EXISTS totp_secret;
ALTER TABLE public.mfa_settings DROP COLUMN IF EXISTS backup_codes;
