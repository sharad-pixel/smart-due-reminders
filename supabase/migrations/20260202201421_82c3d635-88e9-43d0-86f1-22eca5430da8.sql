-- Add PAYDEX and credit intelligence columns to daily_digests
ALTER TABLE public.daily_digests
ADD COLUMN IF NOT EXISTS avg_paydex_score numeric,
ADD COLUMN IF NOT EXISTS avg_paydex_rating text,
ADD COLUMN IF NOT EXISTS accounts_prompt_payers integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS accounts_slow_payers integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS accounts_delinquent integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_payment_trend text,
ADD COLUMN IF NOT EXISTS total_credit_limit_recommended numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS portfolio_risk_summary jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.daily_digests.avg_paydex_score IS 'Average PAYDEX score across all accounts (1-100)';
COMMENT ON COLUMN public.daily_digests.avg_paydex_rating IS 'Overall portfolio credit rating based on avg PAYDEX';
COMMENT ON COLUMN public.daily_digests.accounts_prompt_payers IS 'Count of accounts with PAYDEX >= 80';
COMMENT ON COLUMN public.daily_digests.accounts_slow_payers IS 'Count of accounts with PAYDEX 50-79';
COMMENT ON COLUMN public.daily_digests.accounts_delinquent IS 'Count of accounts with PAYDEX < 50';
COMMENT ON COLUMN public.daily_digests.avg_payment_trend IS 'Overall portfolio payment trend (Improving, Stable, Declining)';
COMMENT ON COLUMN public.daily_digests.total_credit_limit_recommended IS 'Sum of recommended credit limits across portfolio';
COMMENT ON COLUMN public.daily_digests.portfolio_risk_summary IS 'JSON summary of portfolio risk distribution';