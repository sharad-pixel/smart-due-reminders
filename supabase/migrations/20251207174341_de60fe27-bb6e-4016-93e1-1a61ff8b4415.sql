-- Add suspension fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_suspended boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS suspended_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS suspended_reason text,
ADD COLUMN IF NOT EXISTS suspended_by uuid;

-- Create a security definer function to check if user is suspended
CREATE OR REPLACE FUNCTION public.is_user_suspended(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_suspended FROM public.profiles WHERE id = _user_id),
    false
  )
$$;

-- Create index for faster suspension checks
CREATE INDEX IF NOT EXISTS idx_profiles_is_suspended ON public.profiles(is_suspended) WHERE is_suspended = true;