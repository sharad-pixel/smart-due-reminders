
-- Create referrals table
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL,
  referral_code TEXT NOT NULL UNIQUE,
  referred_email TEXT,
  referred_user_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  channel TEXT DEFAULT 'email' CHECK (channel IN ('email', 'linkedin', 'link')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create referral_credits table
CREATE TABLE public.referral_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  referral_id UUID REFERENCES public.referrals(id) ON DELETE SET NULL,
  credits_amount INTEGER NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 0,
  plan_at_referral TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_credits ENABLE ROW LEVEL SECURITY;

-- Referrals policies
CREATE POLICY "Users can view their own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id);

CREATE POLICY "Users can create their own referrals"
  ON public.referrals FOR INSERT
  WITH CHECK (auth.uid() = referrer_id);

-- Referral credits policies
CREATE POLICY "Users can view their own referral credits"
  ON public.referral_credits FOR SELECT
  USING (auth.uid() = user_id);

-- Generate unique referral code function
CREATE OR REPLACE FUNCTION public.generate_referral_code(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Check if user already has a referral code
  SELECT referral_code INTO v_code
  FROM referrals
  WHERE referrer_id = p_user_id
  LIMIT 1;
  
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;
  
  -- Generate unique code
  LOOP
    v_code := 'RCP-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));
    SELECT EXISTS(SELECT 1 FROM referrals WHERE referral_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_code;
END;
$$;

-- Function to get referral credits for a plan
CREATE OR REPLACE FUNCTION public.get_referral_credits_for_plan(p_plan_type TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE p_plan_type
    WHEN 'solo_pro' THEN 20
    WHEN 'starter' THEN 50
    WHEN 'growth' THEN 75
    WHEN 'pro' THEN 100
    WHEN 'professional' THEN 100
    WHEN 'enterprise' THEN 0
    ELSE 0
  END;
$$;

-- Function to get user's total available referral credits
CREATE OR REPLACE FUNCTION public.get_available_referral_credits(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(credits_amount - credits_used), 0)::INTEGER
  FROM referral_credits
  WHERE user_id = p_user_id
    AND expires_at > now()
    AND credits_used < credits_amount;
$$;

-- Indexes
CREATE INDEX idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX idx_referrals_referral_code ON public.referrals(referral_code);
CREATE INDEX idx_referrals_referred_email ON public.referrals(referred_email);
CREATE INDEX idx_referral_credits_user_id ON public.referral_credits(user_id);
CREATE INDEX idx_referral_credits_expires_at ON public.referral_credits(expires_at);

-- Triggers
CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_referral_credits_updated_at
  BEFORE UPDATE ON public.referral_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
