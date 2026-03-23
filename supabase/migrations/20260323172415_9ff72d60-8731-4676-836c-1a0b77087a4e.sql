
-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_debtor ON public.payments (debtor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user_date ON public.payments (user_id, payment_date DESC);

-- Audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs (resource_type, resource_id);

-- Rate limits
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON public.rate_limits (identifier, action_type, window_start DESC);

-- Account users
CREATE INDEX IF NOT EXISTS idx_account_users_user_status ON public.account_users (user_id, status);
CREATE INDEX IF NOT EXISTS idx_account_users_account_status ON public.account_users (account_id, status);

-- Daily digests
CREATE INDEX IF NOT EXISTS idx_daily_digests_user_date ON public.daily_digests (user_id, digest_date DESC);

-- Campaign accounts
CREATE INDEX IF NOT EXISTS idx_campaign_accounts_campaign ON public.campaign_accounts (campaign_id, status);
