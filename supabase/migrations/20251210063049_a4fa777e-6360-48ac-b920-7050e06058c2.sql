-- Add po_number column to invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS po_number TEXT;