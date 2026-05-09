
-- ============================================================
-- LIVE CONTRACT INGESTION — additive schema
-- ============================================================

-- Drive folders selected for live contract scanning
CREATE TABLE public.live_contract_drive_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  user_id UUID NOT NULL,
  connection_id UUID NOT NULL,
  folder_id TEXT NOT NULL,
  folder_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, folder_id)
);
CREATE INDEX idx_lc_folders_account ON public.live_contract_drive_folders(account_id);

-- Scan jobs (history of each folder scan run)
CREATE TABLE public.live_contract_scan_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  folder_id UUID REFERENCES public.live_contract_drive_folders(id) ON DELETE CASCADE,
  triggered_by UUID,
  status TEXT NOT NULL DEFAULT 'queued', -- queued, running, completed, failed
  files_found INTEGER NOT NULL DEFAULT 0,
  files_new INTEGER NOT NULL DEFAULT 0,
  files_duplicate INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lc_scan_jobs_account ON public.live_contract_scan_jobs(account_id);

-- One row per discovered or uploaded contract
CREATE TABLE public.live_contract_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  user_id UUID NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('drive','upload')),
  folder_id UUID REFERENCES public.live_contract_drive_folders(id) ON DELETE SET NULL,
  scan_job_id UUID REFERENCES public.live_contract_scan_jobs(id) ON DELETE SET NULL,
  drive_file_id TEXT,
  storage_path TEXT,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  status TEXT NOT NULL DEFAULT 'found',
    -- found, queued, scanning, ocr_processing, ai_extracting, needs_review, approved, imported, duplicate, failed, rejected
  confidence NUMERIC(5,2),
  debtor_id UUID,
  contract_name TEXT,
  contract_type TEXT,
  effective_date DATE,
  term_end_date DATE,
  duplicate_of UUID REFERENCES public.live_contract_imports(id) ON DELETE SET NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lc_imports_account ON public.live_contract_imports(account_id);
CREATE INDEX idx_lc_imports_status ON public.live_contract_imports(account_id, status);
CREATE INDEX idx_lc_imports_debtor ON public.live_contract_imports(debtor_id);
CREATE UNIQUE INDEX idx_lc_imports_dedupe_drive ON public.live_contract_imports(account_id, drive_file_id) WHERE drive_file_id IS NOT NULL;

-- Raw AI extraction result per import
CREATE TABLE public.live_contract_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  import_id UUID NOT NULL REFERENCES public.live_contract_imports(id) ON DELETE CASCADE,
  raw_text TEXT,
  ai_response JSONB,
  model TEXT,
  tokens_used INTEGER,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lc_extractions_import ON public.live_contract_extractions(import_id);

-- Field-level extracted values
CREATE TABLE public.live_contract_extracted_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  extraction_id UUID NOT NULL REFERENCES public.live_contract_extractions(id) ON DELETE CASCADE,
  import_id UUID NOT NULL REFERENCES public.live_contract_imports(id) ON DELETE CASCADE,
  field_group TEXT NOT NULL, -- customer, contract, commercial, dates, invoice, legal, poc
  field_key TEXT NOT NULL,
  field_value TEXT,
  field_value_json JSONB,
  confidence NUMERIC(5,2),
  source_snippet TEXT,
  page_ref TEXT,
  edited_by_user UUID,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lc_fields_import ON public.live_contract_extracted_fields(import_id);

-- Review assignment / status
CREATE TABLE public.live_contract_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  import_id UUID NOT NULL UNIQUE REFERENCES public.live_contract_imports(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_review, approved, rejected, needs_rescan
  assigned_to UUID,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lc_review_account ON public.live_contract_review_queue(account_id, status);

-- Suggested debtor matches per import
CREATE TABLE public.contract_customer_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  import_id UUID NOT NULL REFERENCES public.live_contract_imports(id) ON DELETE CASCADE,
  candidate_debtor_id UUID,
  match_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  match_reasons JSONB,
  is_selected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ccm_import ON public.contract_customer_matches(import_id);

-- Critical dates
CREATE TABLE public.contract_critical_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  import_id UUID NOT NULL REFERENCES public.live_contract_imports(id) ON DELETE CASCADE,
  debtor_id UUID,
  date_type TEXT NOT NULL,
  due_date DATE NOT NULL,
  notice_days INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  risk_level TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ccd_import ON public.contract_critical_dates(import_id);
CREATE INDEX idx_ccd_account_date ON public.contract_critical_dates(account_id, due_date);

-- Expected invoice schedule (NOT real invoices)
CREATE TABLE public.contract_invoice_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  import_id UUID NOT NULL REFERENCES public.live_contract_imports(id) ON DELETE CASCADE,
  debtor_id UUID,
  scheduled_date DATE NOT NULL,
  service_period_start DATE,
  service_period_end DATE,
  amount NUMERIC(18,2),
  currency TEXT DEFAULT 'USD',
  billing_type TEXT, -- monthly, quarterly, annual, upfront, milestone, usage, poc, implementation, professional_services, one_time
  payment_terms TEXT,
  expected_due_date DATE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'forecast',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cis_import ON public.contract_invoice_schedules(import_id);
CREATE INDEX idx_cis_account_date ON public.contract_invoice_schedules(account_id, scheduled_date);

-- Risk flags
CREATE TABLE public.contract_risk_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  import_id UUID NOT NULL REFERENCES public.live_contract_imports(id) ON DELETE CASCADE,
  debtor_id UUID,
  flag_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, critical
  description TEXT,
  source_field TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_crf_import ON public.contract_risk_flags(import_id);
CREATE INDEX idx_crf_account_sev ON public.contract_risk_flags(account_id, severity);

-- POC / pilot details
CREATE TABLE public.contract_poc_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  import_id UUID NOT NULL UNIQUE REFERENCES public.live_contract_imports(id) ON DELETE CASCADE,
  debtor_id UUID,
  poc_start DATE,
  poc_end DATE,
  conversion_terms TEXT,
  pilot_fee NUMERIC(18,2),
  success_criteria TEXT,
  conversion_language TEXT,
  termination_rights TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cpd_account ON public.contract_poc_details(account_id);

-- Source document metadata
CREATE TABLE public.contract_source_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  import_id UUID NOT NULL REFERENCES public.live_contract_imports(id) ON DELETE CASCADE,
  storage_path TEXT,
  page_count INTEGER,
  text_extracted BOOLEAN DEFAULT false,
  ocr_used BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_csd_import ON public.contract_source_documents(import_id);

-- Audit log
CREATE TABLE public.live_contract_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  import_id UUID REFERENCES public.live_contract_imports(id) ON DELETE CASCADE,
  user_id UUID,
  event_type TEXT NOT NULL,
  event_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lcal_account_created ON public.live_contract_audit_log(account_id, created_at DESC);
CREATE INDEX idx_lcal_import ON public.live_contract_audit_log(import_id);

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE TRIGGER trg_lc_folders_updated BEFORE UPDATE ON public.live_contract_drive_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lc_imports_updated BEFORE UPDATE ON public.live_contract_imports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lc_fields_updated BEFORE UPDATE ON public.live_contract_extracted_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lc_review_updated BEFORE UPDATE ON public.live_contract_review_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.live_contract_drive_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_contract_scan_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_contract_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_contract_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_contract_extracted_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_contract_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_customer_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_critical_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_invoice_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_risk_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_poc_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_contract_audit_log ENABLE ROW LEVEL SECURITY;

-- Helper: identical RLS for each account-scoped table
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'live_contract_drive_folders',
    'live_contract_scan_jobs',
    'live_contract_imports',
    'live_contract_extractions',
    'live_contract_extracted_fields',
    'live_contract_review_queue',
    'contract_customer_matches',
    'contract_critical_dates',
    'contract_invoice_schedules',
    'contract_risk_flags',
    'contract_poc_details',
    'contract_source_documents',
    'live_contract_audit_log'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('CREATE POLICY "lc_read_%I" ON public.%I FOR SELECT USING (public.can_access_account_data(auth.uid(), account_id) OR public.is_recouply_admin(auth.uid()))', t, t);
    EXECUTE format('CREATE POLICY "lc_insert_%I" ON public.%I FOR INSERT WITH CHECK (public.can_write_as_account(auth.uid(), account_id))', t, t);
    EXECUTE format('CREATE POLICY "lc_update_%I" ON public.%I FOR UPDATE USING (public.can_write_as_account(auth.uid(), account_id))', t, t);
    EXECUTE format('CREATE POLICY "lc_delete_%I" ON public.%I FOR DELETE USING (public.can_write_as_account(auth.uid(), account_id))', t, t);
  END LOOP;
END$$;

-- ============================================================
-- Storage bucket (private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('live-contracts', 'live-contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Per-account folder access in storage (path: <account_id>/<file>)
CREATE POLICY "lc_storage_read"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'live-contracts'
  AND public.can_access_account_data(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "lc_storage_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'live-contracts'
  AND public.can_write_as_account(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "lc_storage_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'live-contracts'
  AND public.can_write_as_account(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "lc_storage_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'live-contracts'
  AND public.can_write_as_account(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
