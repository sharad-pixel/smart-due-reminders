
-- Tighten RLS on live contract tables: remove blanket admin bypass.
-- Admins should access customer contracts only via support_access_grants
-- (already honored by can_access_account_data -> is_support_with_access).

-- contracts table: drop blanket admin ALL policy
DROP POLICY IF EXISTS "Admins manage all contracts" ON public.contracts;

-- Helper to recreate SELECT policies without admin bypass
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'contract_critical_dates',
    'contract_customer_matches',
    'contract_invoice_schedules',
    'contract_poc_details',
    'contract_risk_flags',
    'contract_source_documents',
    'live_contract_audit_log',
    'live_contract_drive_folders',
    'live_contract_extracted_fields',
    'live_contract_extractions',
    'live_contract_imports',
    'live_contract_review_queue',
    'live_contract_scan_jobs'
  ];
  policy_name text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    policy_name := 'lc_read_' || t;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (public.can_access_account_data(auth.uid(), account_id))',
      policy_name, t
    );
  END LOOP;
END$$;
