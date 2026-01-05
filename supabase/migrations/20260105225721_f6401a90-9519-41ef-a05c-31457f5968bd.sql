-- Add unique indexes for QuickBooks sync upserts
-- These support the onConflict constraints used in sync-quickbooks-data

-- Unique index for debtors: (user_id, quickbooks_customer_id) where quickbooks_customer_id is not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_debtors_user_qb_customer 
ON public.debtors (user_id, quickbooks_customer_id) 
WHERE quickbooks_customer_id IS NOT NULL;

-- Unique index for invoices: (user_id, quickbooks_invoice_id) where quickbooks_invoice_id is not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_user_qb_invoice 
ON public.invoices (user_id, quickbooks_invoice_id) 
WHERE quickbooks_invoice_id IS NOT NULL;