-- Make invoice_id nullable on ai_drafts table to support responses without linked invoices
ALTER TABLE public.ai_drafts ALTER COLUMN invoice_id DROP NOT NULL;