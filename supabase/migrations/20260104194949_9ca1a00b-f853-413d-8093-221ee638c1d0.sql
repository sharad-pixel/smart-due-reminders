-- Fix privilege escalation vulnerability in profiles table
-- Using column-level grants to protect sensitive fields

-- First, revoke ALL UPDATE privileges on profiles from authenticated users
REVOKE UPDATE ON public.profiles FROM authenticated;

-- Grant UPDATE only on safe user-editable columns
GRANT UPDATE (
  name,
  email,
  phone,
  avatar_url,
  company_name,
  business_name,
  business_address,
  business_phone,
  business_address_line1,
  business_address_line2,
  business_city,
  business_state,
  business_postal_code,
  business_country,
  sendgrid_api_key,
  smtp_settings,
  twilio_account_sid,
  twilio_auth_token,
  twilio_from_number,
  stripe_payment_link_url,
  address_autocomplete_enabled,
  address_autocomplete_provider,
  address_autocomplete_api_key,
  daily_digest_email_enabled,
  updated_at
) ON public.profiles TO authenticated;

-- Note: The following sensitive columns are now protected and cannot be updated by users:
-- is_admin, is_suspended, suspended_at, suspended_reason, suspended_by
-- plan_type, plan_id, stripe_customer_id, stripe_subscription_id
-- invoice_limit, overage_rate, billing_interval, subscription_status
-- current_period_end, trial_ends_at, trial_used_at
-- cancel_at_period_end, is_account_locked, account_locked_at
-- payment_failure_notice_sent_at, payment_failure_count
-- welcome_email_sent_at, created_at, id, password_hash