
-- 1) Encrypted token columns
ALTER TABLE public.crm_connections
  ADD COLUMN IF NOT EXISTS access_token_encrypted text,
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted text;

ALTER TABLE public.drive_connections
  ADD COLUMN IF NOT EXISTS access_token_encrypted text,
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted text;

COMMENT ON COLUMN public.crm_connections.access_token IS 'DEPRECATED plaintext. Use access_token_encrypted. Retained only so existing connections keep working until users re-authenticate.';
COMMENT ON COLUMN public.crm_connections.refresh_token IS 'DEPRECATED plaintext. Use refresh_token_encrypted.';
COMMENT ON COLUMN public.drive_connections.access_token IS 'DEPRECATED plaintext. Use access_token_encrypted.';
COMMENT ON COLUMN public.drive_connections.refresh_token IS 'DEPRECATED plaintext. Use refresh_token_encrypted.';

-- 2) invoice_data_audit: replace the ineffective JWT-role check with a real service_role policy
DROP POLICY IF EXISTS "Service role manages invoice audit" ON public.invoice_data_audit;

CREATE POLICY "Service role manages invoice audit"
  ON public.invoice_data_audit
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3) Document that debtor_risk_profiles writes are intentionally service-role-only
COMMENT ON TABLE public.debtor_risk_profiles IS
  'Risk profiles are computed and written exclusively by backend services (service_role). Authenticated users have read-only access scoped by RLS to their own or delegated debtors. INSERT/UPDATE/DELETE by end users is intentionally not permitted.';
