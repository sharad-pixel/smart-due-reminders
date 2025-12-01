-- Extend invoices table with import/export fields
ALTER TABLE invoices 
  ADD COLUMN IF NOT EXISTS external_invoice_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS source_system TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS aging_bucket TEXT,
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;

-- Create index on external_invoice_id for faster lookups during imports
CREATE INDEX IF NOT EXISTS idx_invoices_external_invoice_id ON invoices(external_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_source_system ON invoices(source_system);

-- Invoice Import Jobs Table
CREATE TABLE IF NOT EXISTS invoice_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  total_rows INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  mode TEXT NOT NULL CHECK (mode IN ('INSERT_ONLY', 'UPSERT_BY_EXTERNAL_INVOICE_ID')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Invoice Import Errors Table
CREATE TABLE IF NOT EXISTS invoice_import_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL REFERENCES invoice_import_jobs(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  raw_row_json JSONB NOT NULL,
  error_message TEXT NOT NULL
);

-- Invoice Status Update Jobs Table
CREATE TABLE IF NOT EXISTS invoice_status_update_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  total_rows INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Invoice Status Update Errors Table
CREATE TABLE IF NOT EXISTS invoice_status_update_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_update_job_id UUID NOT NULL REFERENCES invoice_status_update_jobs(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  raw_row_json JSONB NOT NULL,
  error_message TEXT NOT NULL
);

-- Enable RLS on new tables
ALTER TABLE invoice_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_import_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_status_update_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_status_update_errors ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoice_import_jobs
CREATE POLICY "Users can view their own import jobs"
  ON invoice_import_jobs FOR SELECT
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can create their own import jobs"
  ON invoice_import_jobs FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update their own import jobs"
  ON invoice_import_jobs FOR UPDATE
  USING (auth.uid() = created_by_user_id);

-- RLS Policies for invoice_import_errors
CREATE POLICY "Users can view errors from their import jobs"
  ON invoice_import_errors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoice_import_jobs
      WHERE invoice_import_jobs.id = invoice_import_errors.import_job_id
      AND invoice_import_jobs.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert import errors"
  ON invoice_import_errors FOR INSERT
  WITH CHECK (true);

-- RLS Policies for invoice_status_update_jobs
CREATE POLICY "Users can view their own status update jobs"
  ON invoice_status_update_jobs FOR SELECT
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can create their own status update jobs"
  ON invoice_status_update_jobs FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update their own status update jobs"
  ON invoice_status_update_jobs FOR UPDATE
  USING (auth.uid() = created_by_user_id);

-- RLS Policies for invoice_status_update_errors
CREATE POLICY "Users can view errors from their status update jobs"
  ON invoice_status_update_errors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoice_status_update_jobs
      WHERE invoice_status_update_jobs.id = invoice_status_update_errors.status_update_job_id
      AND invoice_status_update_jobs.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert status update errors"
  ON invoice_status_update_errors FOR INSERT
  WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_import_jobs_user_id ON invoice_import_jobs(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON invoice_import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_errors_job_id ON invoice_import_errors(import_job_id);
CREATE INDEX IF NOT EXISTS idx_status_update_jobs_user_id ON invoice_status_update_jobs(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_status_update_errors_job_id ON invoice_status_update_errors(status_update_job_id);