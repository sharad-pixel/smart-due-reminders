
ALTER TABLE public.user_alerts DROP CONSTRAINT IF EXISTS user_alerts_alert_type_check;
ALTER TABLE public.user_alerts ADD CONSTRAINT user_alerts_alert_type_check
  CHECK (alert_type = ANY (ARRAY[
    'email_bounced','email_invalid','email_rejected','email_complained',
    'outreach_paused','outreach_resumed','sync_failed','payment_received','system',
    'contract_renewal','contract_opt_out','contract_expiration','contract_milestone','contract_invoice_due'
  ]));

ALTER TABLE public.contract_invoice_schedules
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_created_at timestamptz;

ALTER TABLE public.contract_critical_dates
  ADD COLUMN IF NOT EXISTS alert_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alert_lead_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS last_alerted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ccd_alert_enabled ON public.contract_critical_dates(alert_enabled, due_date) WHERE alert_enabled = true;
