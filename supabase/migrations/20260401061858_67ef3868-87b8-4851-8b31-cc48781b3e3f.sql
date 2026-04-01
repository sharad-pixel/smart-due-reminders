ALTER TABLE public.invoices DROP CONSTRAINT invoices_integration_source_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_integration_source_check CHECK (integration_source = ANY (ARRAY['recouply_manual', 'csv_upload', 'stripe', 'quickbooks', 'xero', 'ai_ingestion']));
