
-- Google Drive connections table
CREATE TABLE public.drive_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  provider TEXT NOT NULL DEFAULT 'google_drive',
  folder_id TEXT,
  folder_name TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  sync_frequency TEXT DEFAULT 'manual',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.drive_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own drive connections"
  ON public.drive_connections FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Scanned files tracking table
CREATE TABLE public.ingestion_scanned_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  connection_id UUID NOT NULL REFERENCES public.drive_connections(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  folder_path TEXT,
  mime_type TEXT,
  file_size BIGINT,
  scan_timestamp TIMESTAMPTZ DEFAULT now(),
  processing_status TEXT DEFAULT 'pending',
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  error_message TEXT,
  extraction_result JSONB,
  confidence_score INTEGER,
  is_duplicate BOOLEAN DEFAULT false,
  duplicate_of_invoice_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(connection_id, file_id)
);

ALTER TABLE public.ingestion_scanned_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own scanned files"
  ON public.ingestion_scanned_files FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Review queue table for extracted invoices
CREATE TABLE public.ingestion_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  scanned_file_id UUID NOT NULL REFERENCES public.ingestion_scanned_files(id) ON DELETE CASCADE,
  extracted_invoice_number TEXT,
  extracted_invoice_date DATE,
  extracted_due_date DATE,
  extracted_debtor_name TEXT,
  extracted_company_name TEXT,
  extracted_amount NUMERIC,
  extracted_outstanding_balance NUMERIC,
  extracted_po_number TEXT,
  extracted_billing_email TEXT,
  extracted_address TEXT,
  confidence_score INTEGER DEFAULT 0,
  confidence_breakdown JSONB,
  matched_debtor_id UUID REFERENCES public.debtors(id),
  debtor_match_confidence INTEGER,
  review_status TEXT DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  validation_errors JSONB,
  is_duplicate BOOLEAN DEFAULT false,
  duplicate_invoice_id UUID,
  created_invoice_id UUID REFERENCES public.invoices(id),
  created_debtor_id UUID,
  edits_made JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ingestion_review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own review items"
  ON public.ingestion_review_queue FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Ingestion audit log
CREATE TABLE public.ingestion_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  scanned_file_id UUID REFERENCES public.ingestion_scanned_files(id),
  review_item_id UUID REFERENCES public.ingestion_review_queue(id),
  event_type TEXT NOT NULL,
  event_details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ingestion_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit log"
  ON public.ingestion_audit_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert audit log"
  ON public.ingestion_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX idx_scanned_files_user_status ON public.ingestion_scanned_files(user_id, processing_status);
CREATE INDEX idx_scanned_files_connection ON public.ingestion_scanned_files(connection_id);
CREATE INDEX idx_review_queue_user_status ON public.ingestion_review_queue(user_id, review_status);
CREATE INDEX idx_review_queue_scanned_file ON public.ingestion_review_queue(scanned_file_id);
CREATE INDEX idx_ingestion_audit_user ON public.ingestion_audit_log(user_id, created_at);
CREATE INDEX idx_drive_connections_user ON public.drive_connections(user_id);
