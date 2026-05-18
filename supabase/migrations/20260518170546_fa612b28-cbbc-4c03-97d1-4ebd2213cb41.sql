
-- Backfill expected_due_date for contract_invoice_schedules where payment_terms
-- says Net X but expected_due_date was left equal to scheduled_date.
UPDATE public.contract_invoice_schedules
SET expected_due_date = (scheduled_date::date + (
  (regexp_match(payment_terms, '\m(?:n|net)[ \-\/]*([0-9]{1,3})\M', 'i'))[1]::int
) * INTERVAL '1 day')::date
WHERE invoice_id IS NULL
  AND scheduled_date IS NOT NULL
  AND payment_terms IS NOT NULL
  AND payment_terms ~* '\m(?:n|net)[ \-\/]*[0-9]{1,3}\M'
  AND (expected_due_date IS NULL OR expected_due_date = scheduled_date);
