
-- Add sync_log_id to invoices to track which sync run created/updated them
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sync_log_id uuid REFERENCES public.stripe_sync_log(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS is_new_from_sync boolean DEFAULT false;

-- Add sync_log_id to invoice_transactions to track which sync run created them
ALTER TABLE public.invoice_transactions ADD COLUMN IF NOT EXISTS sync_log_id uuid REFERENCES public.stripe_sync_log(id);

-- Add new_invoices_created and new_transactions_created to stripe_sync_log for quick counts
ALTER TABLE public.stripe_sync_log ADD COLUMN IF NOT EXISTS new_invoices_created integer DEFAULT 0;
ALTER TABLE public.stripe_sync_log ADD COLUMN IF NOT EXISTS new_transactions_created integer DEFAULT 0;
ALTER TABLE public.stripe_sync_log ADD COLUMN IF NOT EXISTS updated_invoices_count integer DEFAULT 0;

-- Index for efficient lookups of items by sync run
CREATE INDEX IF NOT EXISTS idx_invoices_sync_log_id ON public.invoices(sync_log_id) WHERE sync_log_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_transactions_sync_log_id ON public.invoice_transactions(sync_log_id) WHERE sync_log_id IS NOT NULL;
