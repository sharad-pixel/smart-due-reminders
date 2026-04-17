-- =====================================================================
-- P1 Security Migration: Lock down plaintext OAuth tokens & API keys
-- =====================================================================
-- Even with row-owner RLS, exposing long-lived OAuth refresh tokens and
-- third-party API keys to the client is dangerous: an XSS or stolen JWT
-- = full integration takeover. These columns are only ever read by edge
-- functions (service role), so revoke client SELECT at the column level.
-- Service role bypasses RLS and column grants, so backend keeps working.
-- =====================================================================

-- 1. profiles: revoke client read on all sensitive token/key columns
REVOKE SELECT (
  quickbooks_access_token,
  quickbooks_refresh_token,
  sendgrid_api_key,
  twilio_auth_token,
  address_autocomplete_api_key,
  email_verification_token
) ON public.profiles FROM authenticated, anon;

-- Allow owner UPDATE (for first-time integration setup) but never SELECT
GRANT UPDATE (
  quickbooks_access_token,
  quickbooks_refresh_token,
  sendgrid_api_key,
  twilio_auth_token,
  address_autocomplete_api_key,
  email_verification_token
) ON public.profiles TO authenticated;

-- 2. crm_connections: revoke client read on access/refresh tokens
REVOKE SELECT (access_token, refresh_token) ON public.crm_connections
  FROM authenticated, anon;

-- 3. drive_connections: revoke client read on access/refresh tokens
REVOKE SELECT (access_token, refresh_token) ON public.drive_connections
  FROM authenticated, anon;

-- =====================================================================
-- Note: stripe_integrations.stripe_secret_key_encrypted is already
-- encrypted at-rest with AES-GCM (see save-stripe-credentials function),
-- so client read of the ciphertext is acceptable. mfa_settings.totp_secret
-- columns are also encrypted. email_accounts already uses *_encrypted
-- naming. No changes needed for those.
-- =====================================================================
