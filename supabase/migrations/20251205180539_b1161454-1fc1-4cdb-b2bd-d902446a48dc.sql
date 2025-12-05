-- Create early access whitelist table
CREATE TABLE public.early_access_whitelist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  used_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.early_access_whitelist ENABLE ROW LEVEL SECURITY;

-- Admins can manage whitelist
CREATE POLICY "Admins can manage whitelist"
  ON public.early_access_whitelist
  FOR ALL
  USING (is_recouply_admin(auth.uid()))
  WITH CHECK (is_recouply_admin(auth.uid()));

-- Anyone can check if their email is whitelisted (for signup validation)
CREATE POLICY "Anyone can check whitelist"
  ON public.early_access_whitelist
  FOR SELECT
  USING (true);

-- Create function to check if email is whitelisted
CREATE OR REPLACE FUNCTION public.is_email_whitelisted(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.early_access_whitelist
    WHERE LOWER(email) = LOWER(check_email)
  )
$$;

-- Create index for faster lookups
CREATE INDEX idx_early_access_whitelist_email ON public.early_access_whitelist(LOWER(email));