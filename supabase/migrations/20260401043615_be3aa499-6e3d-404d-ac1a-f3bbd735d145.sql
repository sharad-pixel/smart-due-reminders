
-- Create ingestion usage charges table
CREATE TABLE public.ingestion_usage_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  review_item_id UUID,
  scanned_file_id UUID,
  file_name TEXT,
  charge_amount NUMERIC(10,2) NOT NULL DEFAULT 0.75,
  billing_period TEXT NOT NULL,
  stripe_invoice_item_id TEXT,
  billed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.ingestion_usage_charges ENABLE ROW LEVEL SECURITY;

-- Users can view their own charges
CREATE POLICY "Users can view own ingestion charges"
  ON public.ingestion_usage_charges
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own charges (on approval)
CREATE POLICY "Users can insert own ingestion charges"
  ON public.ingestion_usage_charges
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Index for billing queries
CREATE INDEX idx_ingestion_charges_user_period ON public.ingestion_usage_charges(user_id, billing_period);
CREATE INDEX idx_ingestion_charges_billed ON public.ingestion_usage_charges(billed_at) WHERE billed_at IS NULL;
