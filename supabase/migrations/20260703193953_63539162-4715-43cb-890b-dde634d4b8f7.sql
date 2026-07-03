
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS billing_period_start date,
  ADD COLUMN IF NOT EXISTS billing_period_end date,
  ADD COLUMN IF NOT EXISTS billing_frequency text,
  ADD COLUMN IF NOT EXISTS next_billing_date date;

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_billing_frequency_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_billing_frequency_check
  CHECK (billing_frequency IS NULL OR billing_frequency IN (
    'one_time','weekly','monthly','quarterly','semi_annual','annual','custom'
  ));

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_billing_period_range_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_billing_period_range_check
  CHECK (
    billing_period_start IS NULL
    OR billing_period_end IS NULL
    OR billing_period_end >= billing_period_start
  );

COMMENT ON COLUMN public.invoices.billing_period_start IS 'Start of the service/billing period this invoice covers.';
COMMENT ON COLUMN public.invoices.billing_period_end IS 'End of the service/billing period this invoice covers.';
COMMENT ON COLUMN public.invoices.billing_frequency IS 'Cadence for recurring invoices: one_time, weekly, monthly, quarterly, semi_annual, annual, custom.';
COMMENT ON COLUMN public.invoices.next_billing_date IS 'For recurring invoices, when the next invoice in the series should be issued.';
