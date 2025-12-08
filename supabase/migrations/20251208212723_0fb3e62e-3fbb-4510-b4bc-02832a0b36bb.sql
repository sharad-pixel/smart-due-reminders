-- Create a general-purpose rate limiting table for all entry points
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL, -- IP, user_id, or composite key
  action_type text NOT NULL, -- 'api_call', 'form_submit', 'file_upload', 'ai_command', etc.
  request_count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  blocked_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_rate_limits_lookup ON public.rate_limits(identifier, action_type, window_start);
CREATE INDEX idx_rate_limits_cleanup ON public.rate_limits(window_start);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (edge functions)
CREATE POLICY "Service role only" ON public.rate_limits
  FOR ALL USING (false);

-- Create suspicious activity log for fraud detection
CREATE TABLE IF NOT EXISTS public.suspicious_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address text,
  action_type text NOT NULL,
  details jsonb DEFAULT '{}',
  severity text DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_suspicious_activity_user ON public.suspicious_activity_log(user_id);
CREATE INDEX idx_suspicious_activity_severity ON public.suspicious_activity_log(severity, created_at);

ALTER TABLE public.suspicious_activity_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view suspicious activity
CREATE POLICY "Admins can view suspicious activity" ON public.suspicious_activity_log
  FOR SELECT USING (public.is_recouply_admin(auth.uid()));

-- Rate limiting check function (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.check_action_rate_limit(
  p_identifier text,
  p_action_type text,
  p_max_requests integer DEFAULT 100,
  p_window_minutes integer DEFAULT 60,
  p_block_duration_minutes integer DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_window_start timestamptz;
  v_now timestamptz := now();
  v_is_blocked boolean := false;
  v_remaining integer;
BEGIN
  v_window_start := v_now - (p_window_minutes || ' minutes')::interval;
  
  -- Check for existing rate limit record
  SELECT * INTO v_record
  FROM rate_limits
  WHERE identifier = p_identifier
    AND action_type = p_action_type
    AND window_start > v_window_start
  ORDER BY window_start DESC
  LIMIT 1;
  
  -- Check if currently blocked
  IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > v_now THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'blocked', true,
      'blocked_until', v_record.blocked_until,
      'message', 'Too many requests. Please try again later.',
      'remaining', 0
    );
  END IF;
  
  -- If no recent record or old window, create new
  IF v_record IS NULL THEN
    INSERT INTO rate_limits (identifier, action_type, request_count, window_start)
    VALUES (p_identifier, p_action_type, 1, v_now);
    
    RETURN jsonb_build_object(
      'allowed', true,
      'blocked', false,
      'remaining', p_max_requests - 1
    );
  END IF;
  
  -- Increment counter
  v_remaining := p_max_requests - v_record.request_count - 1;
  
  IF v_record.request_count >= p_max_requests THEN
    -- Block the identifier
    UPDATE rate_limits
    SET blocked_until = v_now + (p_block_duration_minutes || ' minutes')::interval,
        updated_at = v_now
    WHERE id = v_record.id;
    
    -- Log suspicious activity
    INSERT INTO suspicious_activity_log (ip_address, action_type, details, severity)
    VALUES (
      p_identifier,
      p_action_type,
      jsonb_build_object(
        'reason', 'rate_limit_exceeded',
        'request_count', v_record.request_count,
        'max_requests', p_max_requests
      ),
      CASE 
        WHEN v_record.request_count > p_max_requests * 2 THEN 'high'
        ELSE 'medium'
      END
    );
    
    RETURN jsonb_build_object(
      'allowed', false,
      'blocked', true,
      'blocked_until', v_now + (p_block_duration_minutes || ' minutes')::interval,
      'message', 'Rate limit exceeded. Please try again later.',
      'remaining', 0
    );
  END IF;
  
  -- Update counter
  UPDATE rate_limits
  SET request_count = request_count + 1,
      updated_at = v_now
  WHERE id = v_record.id;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'blocked', false,
    'remaining', v_remaining
  );
END;
$$;

-- Cleanup old rate limit records (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE window_start < now() - interval '24 hours';
END;
$$;

-- Daily usage limits table for account-level throttling
CREATE TABLE IF NOT EXISTS public.daily_usage_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  usage_date date DEFAULT CURRENT_DATE,
  ai_commands_count integer DEFAULT 0,
  file_uploads_count integer DEFAULT 0,
  api_calls_count integer DEFAULT 0,
  email_sends_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, usage_date)
);

ALTER TABLE public.daily_usage_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage" ON public.daily_usage_limits
  FOR SELECT USING (auth.uid() = user_id);

-- Function to check and increment daily usage
CREATE OR REPLACE FUNCTION public.check_daily_usage(
  p_user_id uuid,
  p_usage_type text,
  p_limit integer DEFAULT 1000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count integer;
  v_column_name text;
BEGIN
  -- Map usage type to column
  v_column_name := CASE p_usage_type
    WHEN 'ai_commands' THEN 'ai_commands_count'
    WHEN 'file_uploads' THEN 'file_uploads_count'
    WHEN 'api_calls' THEN 'api_calls_count'
    WHEN 'email_sends' THEN 'email_sends_count'
    ELSE NULL
  END;
  
  IF v_column_name IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'Invalid usage type');
  END IF;
  
  -- Upsert and get current count
  INSERT INTO daily_usage_limits (user_id, usage_date)
  VALUES (p_user_id, CURRENT_DATE)
  ON CONFLICT (user_id, usage_date) DO NOTHING;
  
  -- Get current count using dynamic SQL would be complex, so handle each case
  IF p_usage_type = 'ai_commands' THEN
    SELECT ai_commands_count INTO v_current_count
    FROM daily_usage_limits WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
    
    IF v_current_count >= p_limit THEN
      RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'message', 'Daily AI command limit reached');
    END IF;
    
    UPDATE daily_usage_limits SET ai_commands_count = ai_commands_count + 1, updated_at = now()
    WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
    
  ELSIF p_usage_type = 'file_uploads' THEN
    SELECT file_uploads_count INTO v_current_count
    FROM daily_usage_limits WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
    
    IF v_current_count >= p_limit THEN
      RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'message', 'Daily file upload limit reached');
    END IF;
    
    UPDATE daily_usage_limits SET file_uploads_count = file_uploads_count + 1, updated_at = now()
    WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
    
  ELSIF p_usage_type = 'email_sends' THEN
    SELECT email_sends_count INTO v_current_count
    FROM daily_usage_limits WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
    
    IF v_current_count >= p_limit THEN
      RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'message', 'Daily email send limit reached');
    END IF;
    
    UPDATE daily_usage_limits SET email_sends_count = email_sends_count + 1, updated_at = now()
    WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
  END IF;
  
  RETURN jsonb_build_object('allowed', true, 'remaining', p_limit - COALESCE(v_current_count, 0) - 1);
END;
$$;