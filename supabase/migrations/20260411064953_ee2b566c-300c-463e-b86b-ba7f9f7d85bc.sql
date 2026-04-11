
-- FIX 1: Payment plan installments - scope permissive SELECT to authenticated only
DROP POLICY IF EXISTS "Public can view installments for public payment plans" ON public.payment_plan_installments;

CREATE POLICY "Authenticated can view installments for public payment plans"
ON public.payment_plan_installments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.payment_plans pp 
    WHERE pp.id = payment_plan_installments.payment_plan_id 
    AND pp.public_token IS NOT NULL
  )
);

-- FIX 2: Create a safe admin view that excludes sensitive credentials
-- This should be used by admin-list-users edge function instead of direct table access
CREATE OR REPLACE VIEW public.profiles_admin_safe AS
SELECT 
  id, email, name, company_name, business_name, avatar_url,
  plan_type, plan_id, is_admin, is_suspended, suspended_at, suspended_reason, suspended_by,
  subscription_status, stripe_customer_id, stripe_subscription_id,
  invoice_limit, overage_rate, billing_interval,
  current_period_end, trial_ends_at, trial_used_at,
  cancel_at_period_end, created_at, updated_at,
  daily_digest_email_enabled, welcome_email_sent_at,
  admin_override, admin_override_at, admin_override_by, admin_override_notes,
  business_address, business_phone,
  business_address_line1, business_address_line2, business_city, business_state,
  business_postal_code, business_country, phone,
  email_verified, receive_collection_alerts, receive_daily_digest, receive_product_updates,
  quickbooks_company_name, quickbooks_connected_at, quickbooks_last_sync_at,
  quickbooks_realm_id, quickbooks_sync_enabled, quickbooks_token_expires_at,
  stripe_payment_link_url, account_locked_at, is_account_locked,
  payment_failure_count, payment_failure_notice_sent_at
  -- EXCLUDED sensitive credentials:
  -- quickbooks_access_token, quickbooks_refresh_token, sendgrid_api_key,
  -- twilio_auth_token, twilio_account_sid, smtp_settings, password_hash, 
  -- email_verification_token, email_verification_token_expires_at,
  -- address_autocomplete_api_key
FROM public.profiles;
