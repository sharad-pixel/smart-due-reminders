
ALTER TABLE public.contract_invoice_schedules
  ADD COLUMN IF NOT EXISTS product_category text,
  ADD COLUMN IF NOT EXISTS revenue_type text,
  ADD COLUMN IF NOT EXISTS category_source text;

ALTER TABLE public.live_contract_imports
  ADD COLUMN IF NOT EXISTS industry text;

ALTER TABLE public.contract_critical_dates
  ADD COLUMN IF NOT EXISTS notify_emails text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS notify_channel text NOT NULL DEFAULT 'in_app';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contract_critical_dates_notify_channel_check'
  ) THEN
    ALTER TABLE public.contract_critical_dates
      ADD CONSTRAINT contract_critical_dates_notify_channel_check
      CHECK (notify_channel IN ('in_app','email','both'));
  END IF;
END $$;
