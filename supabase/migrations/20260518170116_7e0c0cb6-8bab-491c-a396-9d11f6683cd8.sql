
-- Backfill non_renewal_notice_start for every import that has a renewal/term_end
-- but no non_renewal_notice_start row yet. Uses notice_days from the existing
-- renewal row when available, otherwise defaults to 90 days.
WITH renewal_rows AS (
  SELECT DISTINCT ON (import_id)
    account_id, import_id, due_date, COALESCE(notice_days, 90) AS notice_days
  FROM public.contract_critical_dates
  WHERE date_type IN ('renewal', 'term_end')
  ORDER BY import_id,
    CASE WHEN date_type = 'renewal' THEN 0 ELSE 1 END,
    due_date ASC
),
missing AS (
  SELECT r.*
  FROM renewal_rows r
  WHERE NOT EXISTS (
    SELECT 1 FROM public.contract_critical_dates c
    WHERE c.import_id = r.import_id
      AND c.date_type = 'non_renewal_notice_start'
  )
)
INSERT INTO public.contract_critical_dates
  (account_id, import_id, date_type, due_date, notice_days, risk_level)
SELECT
  account_id,
  import_id,
  'non_renewal_notice_start',
  (due_date - (notice_days || ' days')::interval)::date,
  notice_days,
  CASE
    WHEN (due_date - (notice_days || ' days')::interval)::date - CURRENT_DATE < 30 THEN 'high'
    WHEN (due_date - (notice_days || ' days')::interval)::date - CURRENT_DATE < 90 THEN 'medium'
    ELSE 'low'
  END
FROM missing;
