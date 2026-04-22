-- 1. Create user_secrets table — service role only, no client access ever.
CREATE TABLE IF NOT EXISTS public.user_secrets (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- QuickBooks OAuth
  quickbooks_access_token text,
  quickbooks_refresh_token text,
  quickbooks_token_expires_at timestamptz,
  -- SendGrid
  sendgrid_api_key text,
  -- Twilio
  twilio_account_sid text,
  twilio_auth_token text,
  -- Address autocomplete
  address_autocomplete_api_key text,
  -- Email verification
  email_verification_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_secrets ENABLE ROW LEVEL SECURITY;

-- Explicit deny-all for client roles. Service role bypasses RLS automatically.
REVOKE ALL ON public.user_secrets FROM anon, authenticated;

-- No SELECT/INSERT/UPDATE/DELETE policies are created → all client access is denied by default with RLS on.

CREATE TRIGGER user_secrets_set_updated_at
BEFORE UPDATE ON public.user_secrets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Migrate existing values from profiles → user_secrets.
INSERT INTO public.user_secrets (
  user_id,
  quickbooks_access_token,
  quickbooks_refresh_token,
  quickbooks_token_expires_at,
  sendgrid_api_key,
  twilio_account_sid,
  twilio_auth_token,
  address_autocomplete_api_key,
  email_verification_token
)
SELECT
  id,
  quickbooks_access_token,
  quickbooks_refresh_token,
  quickbooks_token_expires_at,
  sendgrid_api_key,
  twilio_account_sid,
  twilio_auth_token,
  address_autocomplete_api_key,
  email_verification_token
FROM public.profiles
WHERE
  quickbooks_access_token IS NOT NULL
  OR quickbooks_refresh_token IS NOT NULL
  OR quickbooks_token_expires_at IS NOT NULL
  OR sendgrid_api_key IS NOT NULL
  OR twilio_account_sid IS NOT NULL
  OR twilio_auth_token IS NOT NULL
  OR address_autocomplete_api_key IS NOT NULL
  OR email_verification_token IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- 3. Drop the sensitive columns from profiles.
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS quickbooks_access_token,
  DROP COLUMN IF EXISTS quickbooks_refresh_token,
  DROP COLUMN IF EXISTS quickbooks_token_expires_at,
  DROP COLUMN IF EXISTS sendgrid_api_key,
  DROP COLUMN IF EXISTS twilio_account_sid,
  DROP COLUMN IF EXISTS twilio_auth_token,
  DROP COLUMN IF EXISTS address_autocomplete_api_key,
  DROP COLUMN IF EXISTS email_verification_token;