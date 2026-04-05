
DROP FUNCTION IF EXISTS public.get_safe_team_profile(uuid);

CREATE FUNCTION public.get_safe_team_profile(p_account_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  company_name text,
  avatar_url text,
  plan_type text,
  business_name text,
  subscription_status text,
  trial_ends_at timestamptz,
  billing_interval text,
  stripe_customer_id text,
  stripe_subscription_id text
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
    p.business_name,
    p.subscription_status,
    p.trial_ends_at,
    p.billing_interval,
    p.stripe_customer_id,
    p.stripe_subscription_id
  FROM profiles p
  WHERE p.id = p_account_id;
$$;
