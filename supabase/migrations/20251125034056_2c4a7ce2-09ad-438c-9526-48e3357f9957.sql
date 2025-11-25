-- Create email_accounts table to store connected email accounts
CREATE TABLE IF NOT EXISTS public.email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'gmail', 'outlook', 'yahoo', 'icloud', 'smtp'
  display_name TEXT,
  auth_method TEXT NOT NULL, -- 'oauth', 'app_password', 'smtp'
  
  -- OAuth tokens (encrypted)
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- SMTP/IMAP credentials (encrypted)
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_username TEXT,
  smtp_password_encrypted TEXT,
  smtp_use_tls BOOLEAN DEFAULT true,
  
  imap_host TEXT,
  imap_port INTEGER,
  imap_username TEXT,
  imap_password_encrypted TEXT,
  imap_use_tls BOOLEAN DEFAULT true,
  
  -- Status and health
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  last_verified_at TIMESTAMPTZ,
  last_successful_send TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  
  -- Deliverability indicators
  dkim_status TEXT DEFAULT 'unknown', -- 'pass', 'fail', 'unknown'
  spf_status TEXT DEFAULT 'unknown',
  connection_status TEXT DEFAULT 'pending', -- 'connected', 'failed', 'pending'
  error_message TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on user_id and email_address
CREATE INDEX idx_email_accounts_user_id ON public.email_accounts(user_id);
CREATE INDEX idx_email_accounts_email ON public.email_accounts(email_address);

-- Enable RLS
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own email accounts"
  ON public.email_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email accounts"
  ON public.email_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email accounts"
  ON public.email_accounts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own email accounts"
  ON public.email_accounts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_email_accounts_updated_at
  BEFORE UPDATE ON public.email_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create email_connection_logs table for debugging
CREATE TABLE IF NOT EXISTS public.email_connection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'connection_attempt', 'send_attempt', 'sync_attempt', 'error'
  status TEXT NOT NULL, -- 'success', 'failed'
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.email_connection_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users can view own email connection logs"
  ON public.email_connection_logs
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM email_accounts
    WHERE email_accounts.id = email_connection_logs.email_account_id
    AND email_accounts.user_id = auth.uid()
  ));