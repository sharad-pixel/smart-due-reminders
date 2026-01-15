-- Create a blocked users table to prevent re-registration
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  reason TEXT,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ, -- NULL = permanent
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage blocked users
CREATE POLICY "Admins can view blocked users"
  ON public.blocked_users
  FOR SELECT
  USING (public.is_recouply_admin(auth.uid()));

CREATE POLICY "Admins can manage blocked users"
  ON public.blocked_users
  FOR ALL
  USING (public.is_recouply_admin(auth.uid()));

-- Create a function to check if email is blocked
CREATE OR REPLACE FUNCTION public.is_email_blocked(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE LOWER(email) = LOWER(check_email)
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_blocked_users_email ON public.blocked_users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_blocked_users_expires ON public.blocked_users(expires_at) WHERE expires_at IS NOT NULL;