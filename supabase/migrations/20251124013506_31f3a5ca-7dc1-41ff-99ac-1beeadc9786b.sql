-- Create user_sessions table for device and session tracking
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  ip_address TEXT,
  user_agent TEXT,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_current BOOLEAN DEFAULT false
);

-- Create mfa_settings table
CREATE TABLE IF NOT EXISTS public.mfa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_method TEXT CHECK (mfa_method IN ('email', 'sms', 'totp')),
  phone_number TEXT,
  totp_secret TEXT,
  backup_codes TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create login_attempts table for rate limiting
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  attempt_time TIMESTAMPTZ DEFAULT now(),
  success BOOLEAN DEFAULT false,
  locked_until TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_sessions
CREATE POLICY "Users can view their own sessions"
  ON public.user_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
  ON public.user_sessions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert sessions"
  ON public.user_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update sessions"
  ON public.user_sessions FOR UPDATE
  USING (true);

-- RLS Policies for mfa_settings
CREATE POLICY "Users can view their own MFA settings"
  ON public.mfa_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own MFA settings"
  ON public.mfa_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own MFA settings"
  ON public.mfa_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for login_attempts (admin only)
CREATE POLICY "Only admins can view login attempts"
  ON public.login_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Function to clean old login attempts
CREATE OR REPLACE FUNCTION clean_old_login_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.login_attempts
  WHERE attempt_time < now() - INTERVAL '24 hours';
END;
$$;

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(p_email TEXT, p_ip_address TEXT)
RETURNS TABLE(is_locked BOOLEAN, attempts_count INTEGER, locked_until TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts INTEGER;
  v_locked_until TIMESTAMPTZ;
  v_recent_attempts INTEGER;
BEGIN
  -- Clean old attempts first
  PERFORM clean_old_login_attempts();
  
  -- Check if account is currently locked
  SELECT login_attempts.locked_until INTO v_locked_until
  FROM public.login_attempts
  WHERE email = p_email
    AND locked_until > now()
  ORDER BY attempt_time DESC
  LIMIT 1;
  
  IF v_locked_until IS NOT NULL THEN
    RETURN QUERY SELECT true, 0::INTEGER, v_locked_until;
    RETURN;
  END IF;
  
  -- Count failed attempts in last 15 minutes
  SELECT COUNT(*) INTO v_recent_attempts
  FROM public.login_attempts
  WHERE email = p_email
    AND ip_address = p_ip_address
    AND attempt_time > now() - INTERVAL '15 minutes'
    AND success = false;
  
  RETURN QUERY SELECT false, v_recent_attempts, NULL::TIMESTAMPTZ;
END;
$$;

-- Indexes for performance
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_last_active ON public.user_sessions(last_active_at);
CREATE INDEX idx_login_attempts_email ON public.login_attempts(email);
CREATE INDEX idx_login_attempts_ip ON public.login_attempts(ip_address);
CREATE INDEX idx_login_attempts_time ON public.login_attempts(attempt_time);

-- Trigger to update mfa_settings updated_at
CREATE TRIGGER update_mfa_settings_updated_at
  BEFORE UPDATE ON public.mfa_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();