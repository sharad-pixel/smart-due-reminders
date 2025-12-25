-- Add invoice-level template override columns
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS custom_template_subject text,
ADD COLUMN IF NOT EXISTS custom_template_body text,
ADD COLUMN IF NOT EXISTS use_custom_template boolean DEFAULT false;

-- Add comment explaining the purpose
COMMENT ON COLUMN public.invoices.custom_template_subject IS 'Invoice-level override for outreach email subject template';
COMMENT ON COLUMN public.invoices.custom_template_body IS 'Invoice-level override for outreach email body template';
COMMENT ON COLUMN public.invoices.use_custom_template IS 'When true, use custom template instead of approved draft templates';