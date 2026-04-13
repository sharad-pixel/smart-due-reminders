
-- Add invoice_id, line_item_id, and source_system to payments table
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS line_item_id uuid REFERENCES public.invoice_line_items(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS source_system text;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_line_item_id ON public.payments(line_item_id);
