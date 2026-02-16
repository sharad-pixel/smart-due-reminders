
-- Add collection_alerts_summary JSONB column to daily_digests
ALTER TABLE public.daily_digests
ADD COLUMN IF NOT EXISTS collection_alerts_summary jsonb DEFAULT NULL;

COMMENT ON COLUMN public.daily_digests.collection_alerts_summary IS 'JSON summary of collection alerts: payments_received, risk_changes, overdue_milestones, debtor_responses';
