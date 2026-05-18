-- Fix due_date for any invoice where payment_terms indicates Net X but due_date == issue_date
-- Applies to ALL invoices on the platform (live_contract, csv_upload, manual, etc.)
WITH parsed AS (
  SELECT
    id,
    issue_date,
    due_date,
    payment_terms,
    CASE
      WHEN payment_terms IS NULL THEN NULL
      WHEN payment_terms ~* 'receipt|prepaid|upon' THEN 0
      WHEN payment_terms ~* '(net\s*|n/?)(\d{1,3})' THEN
        (regexp_match(payment_terms, '(?:net\s*|n/?)(\d{1,3})', 'i'))[1]::int
      WHEN payment_terms ~* '(\d{1,3})\s*days?' THEN
        (regexp_match(payment_terms, '(\d{1,3})\s*days?', 'i'))[1]::int
      ELSE NULL
    END AS net_days
  FROM public.invoices
  WHERE payment_terms IS NOT NULL
    AND due_date = issue_date
)
UPDATE public.invoices i
SET due_date = (p.issue_date::date + (p.net_days || ' days')::interval)::date
FROM parsed p
WHERE i.id = p.id
  AND p.net_days IS NOT NULL
  AND p.net_days > 0;

-- Same fix for contract_invoice_schedules.expected_due_date
WITH parsed AS (
  SELECT
    id,
    scheduled_date,
    expected_due_date,
    payment_terms,
    CASE
      WHEN payment_terms IS NULL THEN NULL
      WHEN payment_terms ~* 'receipt|prepaid|upon' THEN 0
      WHEN payment_terms ~* '(net\s*|n/?)(\d{1,3})' THEN
        (regexp_match(payment_terms, '(?:net\s*|n/?)(\d{1,3})', 'i'))[1]::int
      WHEN payment_terms ~* '(\d{1,3})\s*days?' THEN
        (regexp_match(payment_terms, '(\d{1,3})\s*days?', 'i'))[1]::int
      ELSE NULL
    END AS net_days
  FROM public.contract_invoice_schedules
  WHERE payment_terms IS NOT NULL
    AND (expected_due_date IS NULL OR expected_due_date = scheduled_date)
)
UPDATE public.contract_invoice_schedules s
SET expected_due_date = (p.scheduled_date::date + (p.net_days || ' days')::interval)::date
FROM parsed p
WHERE s.id = p.id
  AND p.net_days IS NOT NULL
  AND p.net_days > 0;

-- Recalculate aging buckets for invoices whose due_date just shifted
-- (handled by next scheduled aging job; we just clear stale buckets where today < due_date)
UPDATE public.invoices
SET aging_bucket = 'current',
    bucket_entered_at = now()
WHERE status IN ('Open', 'InPaymentPlan')
  AND due_date::date >= CURRENT_DATE
  AND aging_bucket IS DISTINCT FROM 'current';