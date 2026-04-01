
ALTER TABLE public.daily_digests
ADD COLUMN IF NOT EXISTS revenue_risk_summary jsonb DEFAULT NULL;

COMMENT ON COLUMN public.daily_digests.revenue_risk_summary IS 'Revenue risk intelligence snapshot: total ECL, avg collectability score, risk tier distribution, top risk accounts';
