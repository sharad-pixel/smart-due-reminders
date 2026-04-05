
-- Remove sensitive tables from Supabase Realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.debtors;
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_notifications;
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_alerts;

-- Create a security definer function for safe team profile access
CREATE OR REPLACE FUNCTION public.get_safe_team_profile(p_account_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  company_name text,
  avatar_url text,
  plan_type text,
  business_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.email,
    p.name,
    p.company_name,
    p.avatar_url,
    p.plan_type,
    p.business_name
  FROM profiles p
  WHERE p.id = p_account_id;
$$;
