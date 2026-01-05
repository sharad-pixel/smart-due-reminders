-- 1. Update invoices table with source tracking and override management columns
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS integration_source TEXT DEFAULT 'recouply_manual' CHECK (integration_source IN ('recouply_manual', 'csv_upload', 'stripe', 'quickbooks', 'xero')),
ADD COLUMN IF NOT EXISTS integration_id TEXT,
ADD COLUMN IF NOT EXISTS integration_url TEXT,
ADD COLUMN IF NOT EXISTS has_local_overrides BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS override_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS original_amount NUMERIC,
ADD COLUMN IF NOT EXISTS original_due_date DATE;

-- 2. Create invoice_override_log table
CREATE TABLE IF NOT EXISTS public.invoice_override_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  original_value TEXT,
  new_value TEXT,
  acknowledged_warning BOOLEAN DEFAULT false,
  integration_source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on invoice_override_log
ALTER TABLE public.invoice_override_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoice_override_log
CREATE POLICY "Users can view own override logs"
ON public.invoice_override_log
FOR SELECT
USING (user_id = auth.uid() OR public.can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Users can insert own override logs"
ON public.invoice_override_log
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- 3. Update invoice_transactions table
ALTER TABLE public.invoice_transactions
ADD COLUMN IF NOT EXISTS source_system TEXT DEFAULT 'recouply' CHECK (source_system IN ('recouply', 'stripe', 'quickbooks')),
ADD COLUMN IF NOT EXISTS external_transaction_id TEXT;

-- Add constraint: external transactions must have external_transaction_id
-- Using a trigger since CHECK constraints can't reference other columns conditionally
CREATE OR REPLACE FUNCTION public.validate_external_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.source_system != 'recouply' AND NEW.external_transaction_id IS NULL THEN
    RAISE EXCEPTION 'External transactions must have an external_transaction_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_external_transaction_trigger ON public.invoice_transactions;
CREATE TRIGGER validate_external_transaction_trigger
BEFORE INSERT OR UPDATE ON public.invoice_transactions
FOR EACH ROW
EXECUTE FUNCTION public.validate_external_transaction();

-- 4. Create invoice_sync_conflicts table
CREATE TABLE IF NOT EXISTS public.invoice_sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  integration_source TEXT NOT NULL,
  conflicts JSONB NOT NULL DEFAULT '{}',
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on invoice_sync_conflicts
ALTER TABLE public.invoice_sync_conflicts ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoice_sync_conflicts
CREATE POLICY "Users can view own sync conflicts"
ON public.invoice_sync_conflicts
FOR SELECT
USING (user_id = auth.uid() OR public.can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Users can insert own sync conflicts"
ON public.invoice_sync_conflicts
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sync conflicts"
ON public.invoice_sync_conflicts
FOR UPDATE
USING (user_id = auth.uid() OR public.can_access_account_data(auth.uid(), user_id));

-- 5. MIGRATION: Classify existing invoices
-- Set integration_source based on existing data
UPDATE public.invoices
SET integration_source = 'stripe'
WHERE stripe_invoice_id IS NOT NULL AND integration_source IS NULL;

UPDATE public.invoices
SET integration_source = 'csv_upload'
WHERE external_invoice_id LIKE 'CSV%' AND integration_source IS NULL;

UPDATE public.invoices
SET integration_source = 'recouply_manual'
WHERE integration_source IS NULL;

-- Set original_amount = amount for all invoices where not set
UPDATE public.invoices
SET original_amount = amount
WHERE original_amount IS NULL;

-- Set original_due_date = due_date for all invoices where not set
UPDATE public.invoices
SET original_due_date = due_date
WHERE original_due_date IS NULL;

-- Copy stripe_invoice_id to integration_id for Stripe invoices
UPDATE public.invoices
SET integration_id = stripe_invoice_id
WHERE stripe_invoice_id IS NOT NULL AND integration_id IS NULL;

-- 6. MIGRATION: Update invoice_transactions source_system
UPDATE public.invoice_transactions t
SET source_system = 'stripe', external_transaction_id = COALESCE(t.external_transaction_id, t.reference_number)
FROM public.invoices i
WHERE t.invoice_id = i.id
AND i.stripe_invoice_id IS NOT NULL
AND t.source_system IS NULL;

UPDATE public.invoice_transactions
SET source_system = 'recouply'
WHERE source_system IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_integration_source ON public.invoices(integration_source);
CREATE INDEX IF NOT EXISTS idx_invoices_integration_id ON public.invoices(integration_id);
CREATE INDEX IF NOT EXISTS idx_invoice_override_log_invoice_id ON public.invoice_override_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_sync_conflicts_invoice_id ON public.invoice_sync_conflicts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_sync_conflicts_resolved ON public.invoice_sync_conflicts(resolved) WHERE resolved = false;