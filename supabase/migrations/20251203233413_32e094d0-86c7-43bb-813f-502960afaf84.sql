
-- Upload batches table for tracking all AR data uploads
CREATE TABLE public.upload_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  upload_type TEXT NOT NULL CHECK (upload_type IN ('invoice_detail', 'ar_summary', 'payments')),
  file_name TEXT NOT NULL,
  processed_status TEXT NOT NULL DEFAULT 'pending' CHECK (processed_status IN ('pending', 'preview', 'processed', 'error', 'needs_review')),
  row_count INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  error_message TEXT,
  column_mapping JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- AR Summary table for optional comparison layer
CREATE TABLE public.ar_summary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  debtor_id UUID REFERENCES public.debtors(id) ON DELETE CASCADE,
  bucket_current NUMERIC DEFAULT 0,
  bucket_1_30 NUMERIC DEFAULT 0,
  bucket_31_60 NUMERIC DEFAULT 0,
  bucket_61_90 NUMERIC DEFAULT 0,
  bucket_91_120 NUMERIC DEFAULT 0,
  bucket_120_plus NUMERIC DEFAULT 0,
  as_of_date DATE NOT NULL,
  upload_batch_id UUID REFERENCES public.upload_batches(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  debtor_id UUID REFERENCES public.debtors(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  currency TEXT DEFAULT 'USD',
  amount NUMERIC NOT NULL,
  reference TEXT,
  notes TEXT,
  invoice_number_hint TEXT,
  reconciliation_status TEXT DEFAULT 'pending' CHECK (reconciliation_status IN ('pending', 'auto_matched', 'ai_suggested', 'needs_review', 'manually_matched', 'unapplied')),
  upload_batch_id UUID REFERENCES public.upload_batches(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Payment to Invoice links for reconciliation
CREATE TABLE public.payment_invoice_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount_applied NUMERIC NOT NULL,
  match_confidence NUMERIC DEFAULT 0 CHECK (match_confidence >= 0 AND match_confidence <= 1),
  match_method TEXT NOT NULL CHECK (match_method IN ('exact', 'heuristic', 'ai_suggested', 'manual')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  confirmed_by UUID
);

-- Staging table for upload previews
CREATE TABLE public.upload_staging (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_batch_id UUID NOT NULL REFERENCES public.upload_batches(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  raw_data JSONB NOT NULL,
  mapped_data JSONB,
  validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'error', 'duplicate', 'skip')),
  validation_errors JSONB,
  duplicate_of_id UUID,
  action TEXT DEFAULT 'import' CHECK (action IN ('import', 'skip', 'overwrite')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add amount_original column to invoices if not exists
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS amount_original NUMERIC;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS amount_outstanding NUMERIC;

-- Update existing invoices to set amount_original and amount_outstanding
UPDATE public.invoices SET amount_original = amount WHERE amount_original IS NULL;
UPDATE public.invoices SET amount_outstanding = amount WHERE amount_outstanding IS NULL;

-- Enable RLS on all new tables
ALTER TABLE public.upload_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_invoice_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_staging ENABLE ROW LEVEL SECURITY;

-- RLS policies for upload_batches
CREATE POLICY "Users can view own upload batches" ON public.upload_batches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own upload batches" ON public.upload_batches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own upload batches" ON public.upload_batches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own upload batches" ON public.upload_batches FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for ar_summary
CREATE POLICY "Users can view own AR summaries" ON public.ar_summary FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own AR summaries" ON public.ar_summary FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own AR summaries" ON public.ar_summary FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own AR summaries" ON public.ar_summary FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for payments
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own payments" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own payments" ON public.payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own payments" ON public.payments FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for payment_invoice_links (access through payments)
CREATE POLICY "Users can view own payment links" ON public.payment_invoice_links FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.payments WHERE payments.id = payment_invoice_links.payment_id AND payments.user_id = auth.uid()));
CREATE POLICY "Users can create own payment links" ON public.payment_invoice_links FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.payments WHERE payments.id = payment_invoice_links.payment_id AND payments.user_id = auth.uid()));
CREATE POLICY "Users can update own payment links" ON public.payment_invoice_links FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.payments WHERE payments.id = payment_invoice_links.payment_id AND payments.user_id = auth.uid()));
CREATE POLICY "Users can delete own payment links" ON public.payment_invoice_links FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.payments WHERE payments.id = payment_invoice_links.payment_id AND payments.user_id = auth.uid()));

-- RLS policies for upload_staging
CREATE POLICY "Users can view own staging data" ON public.upload_staging FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.upload_batches WHERE upload_batches.id = upload_staging.upload_batch_id AND upload_batches.user_id = auth.uid()));
CREATE POLICY "Users can create own staging data" ON public.upload_staging FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.upload_batches WHERE upload_batches.id = upload_staging.upload_batch_id AND upload_batches.user_id = auth.uid()));
CREATE POLICY "Users can update own staging data" ON public.upload_staging FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.upload_batches WHERE upload_batches.id = upload_staging.upload_batch_id AND upload_batches.user_id = auth.uid()));
CREATE POLICY "Users can delete own staging data" ON public.upload_staging FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.upload_batches WHERE upload_batches.id = upload_staging.upload_batch_id AND upload_batches.user_id = auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_upload_batches_user_id ON public.upload_batches(user_id);
CREATE INDEX idx_upload_batches_status ON public.upload_batches(processed_status);
CREATE INDEX idx_ar_summary_debtor_id ON public.ar_summary(debtor_id);
CREATE INDEX idx_ar_summary_user_id ON public.ar_summary(user_id);
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_debtor_id ON public.payments(debtor_id);
CREATE INDEX idx_payments_status ON public.payments(reconciliation_status);
CREATE INDEX idx_payment_invoice_links_payment_id ON public.payment_invoice_links(payment_id);
CREATE INDEX idx_payment_invoice_links_invoice_id ON public.payment_invoice_links(invoice_id);
CREATE INDEX idx_upload_staging_batch_id ON public.upload_staging(upload_batch_id);
