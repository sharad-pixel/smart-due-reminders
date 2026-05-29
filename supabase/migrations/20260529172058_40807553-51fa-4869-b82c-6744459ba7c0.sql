
-- Hide sensitive credential columns from client roles by revoking column-level SELECT.
-- PostgREST will exclude these columns from `select *` while RLS continues to scope rows.
-- service_role retains full access for edge functions.

-- stripe_integrations: hide encrypted secret key
REVOKE SELECT (stripe_secret_key_encrypted) ON public.stripe_integrations FROM anon, authenticated;

-- drive_connections: hide raw OAuth tokens
REVOKE SELECT (access_token, refresh_token) ON public.drive_connections FROM anon, authenticated;

-- email_accounts: hide encrypted credentials & tokens
REVOKE SELECT (
  access_token_encrypted,
  refresh_token_encrypted,
  smtp_password_encrypted,
  imap_password_encrypted
) ON public.email_accounts FROM anon, authenticated;
