-- Fix email_accounts RLS policies to use authenticated role instead of public
DROP POLICY IF EXISTS "Users can delete own email accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can insert own email accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can update own email accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can view own email accounts" ON public.email_accounts;

-- Recreate with authenticated role
CREATE POLICY "Users can view own email accounts"
ON public.email_accounts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email accounts"
ON public.email_accounts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email accounts"
ON public.email_accounts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own email accounts"
ON public.email_accounts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Fix mfa_settings RLS policies to use authenticated role instead of public
DROP POLICY IF EXISTS "Users can insert their own MFA settings" ON public.mfa_settings;
DROP POLICY IF EXISTS "Users can update their own MFA settings" ON public.mfa_settings;
DROP POLICY IF EXISTS "Users can view their own MFA settings" ON public.mfa_settings;

-- Recreate with authenticated role
CREATE POLICY "Users can view their own MFA settings"
ON public.mfa_settings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own MFA settings"
ON public.mfa_settings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own MFA settings"
ON public.mfa_settings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own MFA settings"
ON public.mfa_settings
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add encrypted columns for MFA secrets (keeping original columns for backward compatibility during migration)
ALTER TABLE public.mfa_settings 
ADD COLUMN IF NOT EXISTS totp_secret_encrypted text,
ADD COLUMN IF NOT EXISTS backup_codes_encrypted text;