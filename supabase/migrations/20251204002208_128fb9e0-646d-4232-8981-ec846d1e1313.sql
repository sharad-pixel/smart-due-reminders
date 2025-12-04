-- Data Center Sources: Define external system profiles
CREATE TABLE public.data_center_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID,
  source_name TEXT NOT NULL,
  system_type TEXT NOT NULL DEFAULT 'custom',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Data Center Field Definitions: Standardized field schema
CREATE TABLE public.data_center_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  data_type TEXT NOT NULL CHECK (data_type IN ('string', 'number', 'date', 'boolean')),
  required_for_recouply BOOLEAN NOT NULL DEFAULT false,
  required_for_roundtrip BOOLEAN NOT NULL DEFAULT false,
  grouping TEXT NOT NULL CHECK (grouping IN ('customer', 'invoice', 'payment', 'meta')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Data Center Source Field Mappings: Column mappings per source
CREATE TABLE public.data_center_source_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.data_center_sources(id) ON DELETE CASCADE,
  file_column_name TEXT NOT NULL,
  inferred_field_key TEXT,
  confirmed_field_key TEXT,
  confidence_score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Data Center Uploads: Track file uploads
CREATE TABLE public.data_center_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.data_center_sources(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT,
  file_type TEXT NOT NULL CHECK (file_type IN ('invoice_aging', 'payments')),
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'mapping', 'mapped', 'processing', 'processed', 'error', 'needs_review')),
  error_message TEXT,
  row_count INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  matched_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Data Center Staging Rows: Temporary storage for processing
CREATE TABLE public.data_center_staging_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL REFERENCES public.data_center_uploads(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  raw_json JSONB NOT NULL,
  normalized_json JSONB,
  match_status TEXT NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('unmatched', 'matched_customer', 'matched_invoice', 'matched_payment', 'needs_review', 'error')),
  matched_customer_id UUID,
  matched_invoice_id UUID,
  match_confidence NUMERIC,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.data_center_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_center_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_center_source_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_center_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_center_staging_rows ENABLE ROW LEVEL SECURITY;

-- RLS Policies for data_center_sources
CREATE POLICY "Users can view own sources" ON public.data_center_sources FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own sources" ON public.data_center_sources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sources" ON public.data_center_sources FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sources" ON public.data_center_sources FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for data_center_field_definitions (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view field definitions" ON public.data_center_field_definitions FOR SELECT USING (true);

-- RLS Policies for data_center_source_field_mappings
CREATE POLICY "Users can view own source mappings" ON public.data_center_source_field_mappings FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.data_center_sources WHERE id = source_id AND user_id = auth.uid()));
CREATE POLICY "Users can create own source mappings" ON public.data_center_source_field_mappings FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.data_center_sources WHERE id = source_id AND user_id = auth.uid()));
CREATE POLICY "Users can update own source mappings" ON public.data_center_source_field_mappings FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.data_center_sources WHERE id = source_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete own source mappings" ON public.data_center_source_field_mappings FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.data_center_sources WHERE id = source_id AND user_id = auth.uid()));

-- RLS Policies for data_center_uploads
CREATE POLICY "Users can view own uploads" ON public.data_center_uploads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own uploads" ON public.data_center_uploads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own uploads" ON public.data_center_uploads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own uploads" ON public.data_center_uploads FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for data_center_staging_rows
CREATE POLICY "Users can view own staging rows" ON public.data_center_staging_rows FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.data_center_uploads WHERE id = upload_id AND user_id = auth.uid()));
CREATE POLICY "Users can create own staging rows" ON public.data_center_staging_rows FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.data_center_uploads WHERE id = upload_id AND user_id = auth.uid()));
CREATE POLICY "Users can update own staging rows" ON public.data_center_staging_rows FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.data_center_uploads WHERE id = upload_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete own staging rows" ON public.data_center_staging_rows FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.data_center_uploads WHERE id = upload_id AND user_id = auth.uid()));

-- Insert standard field definitions
INSERT INTO public.data_center_field_definitions (key, label, description, data_type, required_for_recouply, required_for_roundtrip, grouping) VALUES
-- Customer fields
('customer_name', 'Customer Name', 'Name of the customer or company', 'string', true, true, 'customer'),
('customer_id', 'Customer ID', 'External customer identifier', 'string', false, true, 'customer'),
('customer_email', 'Customer Email', 'Primary email address', 'string', false, false, 'customer'),
('customer_phone', 'Customer Phone', 'Primary phone number', 'string', false, false, 'customer'),
('billing_address', 'Billing Address', 'Customer billing address', 'string', false, false, 'customer'),
('contact_name', 'Contact Name', 'Primary contact person', 'string', false, false, 'customer'),
-- Invoice fields
('invoice_number', 'Invoice Number', 'Unique invoice identifier', 'string', true, true, 'invoice'),
('invoice_date', 'Invoice Date', 'Date the invoice was issued', 'date', true, true, 'invoice'),
('due_date', 'Due Date', 'Payment due date', 'date', true, true, 'invoice'),
('amount_original', 'Original Amount', 'Original invoice amount', 'number', true, true, 'invoice'),
('amount_outstanding', 'Outstanding Amount', 'Remaining amount to be paid', 'number', false, true, 'invoice'),
('currency', 'Currency', 'Currency code (e.g., USD)', 'string', false, true, 'invoice'),
('invoice_status', 'Invoice Status', 'Current status of the invoice', 'string', false, false, 'invoice'),
('po_number', 'PO Number', 'Purchase order number', 'string', false, false, 'invoice'),
('product_description', 'Product/Service Description', 'Description of products or services', 'string', false, false, 'invoice'),
('external_invoice_id', 'External Invoice ID', 'Invoice ID from source system', 'string', false, true, 'invoice'),
-- Payment fields
('payment_date', 'Payment Date', 'Date payment was received', 'date', true, true, 'payment'),
('payment_amount', 'Payment Amount', 'Amount of the payment', 'number', true, true, 'payment'),
('payment_reference', 'Payment Reference', 'Check number or transaction reference', 'string', false, true, 'payment'),
('payment_method', 'Payment Method', 'Method of payment (check, wire, ACH)', 'string', false, false, 'payment'),
('payment_notes', 'Payment Notes', 'Additional notes or memo', 'string', false, false, 'payment'),
-- Meta fields
('notes', 'Notes', 'General notes or comments', 'string', false, false, 'meta'),
('source_system', 'Source System', 'Name of the originating system', 'string', false, false, 'meta');

-- Add data_center_upload_id to invoices if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'data_center_upload_id') THEN
    ALTER TABLE public.invoices ADD COLUMN data_center_upload_id UUID REFERENCES public.data_center_uploads(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add data_center_upload_id to payments if not exists  
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'data_center_upload_id') THEN
    ALTER TABLE public.payments ADD COLUMN data_center_upload_id UUID REFERENCES public.data_center_uploads(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX idx_data_center_sources_user_id ON public.data_center_sources(user_id);
CREATE INDEX idx_data_center_uploads_user_id ON public.data_center_uploads(user_id);
CREATE INDEX idx_data_center_uploads_source_id ON public.data_center_uploads(source_id);
CREATE INDEX idx_data_center_uploads_status ON public.data_center_uploads(status);
CREATE INDEX idx_data_center_staging_rows_upload_id ON public.data_center_staging_rows(upload_id);
CREATE INDEX idx_data_center_staging_rows_match_status ON public.data_center_staging_rows(match_status);
CREATE INDEX idx_data_center_source_field_mappings_source_id ON public.data_center_source_field_mappings(source_id);