-- Allow team members to inherit owner's subscription status and business profile
-- without exposing credentials/secrets stored on the profiles row.
--
-- Background: Team members were seeing a false "Subscription Expired" banner
-- because RLS blocked them from reading the parent account's profile, so
-- ownerSubscriptionStatus came back null and the Layout treated null as expired.

CREATE OR REPLACE FUNCTION public.get_owner_account_info(p_account_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  company_name text,
  plan_type text,
  subscription_status text,
  avatar_url text,
  business_name text,
  business_phone text,
  business_address_line1 text,
  business_address_line2 text,
  business_city text,
  business_state text,
  business_postal_code text,
  business_country text,
  stripe_payment_link_url text,
  is_account_locked boolean,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  billing_interval text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only return data if caller is the account owner OR an active team member of this account
  IF NOT (
    auth.uid() = p_account_id
    OR EXISTS (
      SELECT 1 FROM public.account_users au
      WHERE au.user_id = auth.uid()
        AND au.account_id = p_account_id
        AND au.status = 'active'
    )
    OR public.is_recouply_admin(auth.uid())
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.email,
    p.company_name,
    p.plan_type,
    p.subscription_status,
    p.avatar_url,
    p.business_name,
    p.business_phone,
    p.business_address_line1,
    p.business_address_line2,
    p.business_city,
    p.business_state,
    p.business_postal_code,
    p.business_country,
    p.stripe_payment_link_url,
    p.is_account_locked,
    p.current_period_end,
    p.trial_ends_at,
    p.billing_interval
  FROM public.profiles p
  WHERE p.id = p_account_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_owner_account_info(uuid) TO authenticated;