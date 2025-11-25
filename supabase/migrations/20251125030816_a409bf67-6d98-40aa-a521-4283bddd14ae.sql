-- Create email sending profiles table for BYOD
CREATE TABLE IF NOT EXISTS public.email_sending_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  domain TEXT NOT NULL,
  spf_validated BOOLEAN DEFAULT false,
  dkim_validated BOOLEAN DEFAULT false,
  dmarc_validated BOOLEAN DEFAULT false,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed', 'warning')),
  use_recouply_domain BOOLEAN DEFAULT false,
  spf_record TEXT,
  dkim_record TEXT,
  return_path_record TEXT,
  dmarc_record TEXT,
  bounce_rate NUMERIC DEFAULT 0,
  spam_complaint_rate NUMERIC DEFAULT 0,
  domain_reputation TEXT DEFAULT 'unknown' CHECK (domain_reputation IN ('good', 'average', 'poor', 'unknown')),
  last_verified_at TIMESTAMPTZ,
  api_credentials_encrypted TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_sending_profiles_user_id ON public.email_sending_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_email_sending_profiles_domain ON public.email_sending_profiles(domain);

-- Enable RLS
ALTER TABLE public.email_sending_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own email profiles"
  ON public.email_sending_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own email profiles"
  ON public.email_sending_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email profiles"
  ON public.email_sending_profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own email profiles"
  ON public.email_sending_profiles
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_email_sending_profiles_updated_at
  BEFORE UPDATE ON public.email_sending_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create DNS verification logs table
CREATE TABLE IF NOT EXISTS public.dns_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_profile_id UUID NOT NULL REFERENCES public.email_sending_profiles(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL CHECK (record_type IN ('SPF', 'DKIM', 'DMARC', 'RETURN_PATH')),
  verification_result BOOLEAN DEFAULT false,
  error_message TEXT,
  checked_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on logs
ALTER TABLE public.dns_verification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own DNS logs"
  ON public.dns_verification_logs
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.email_sending_profiles
    WHERE id = dns_verification_logs.email_profile_id
    AND user_id = auth.uid()
  ));