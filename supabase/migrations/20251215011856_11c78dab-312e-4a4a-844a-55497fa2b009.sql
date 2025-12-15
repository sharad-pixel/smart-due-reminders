-- Add outreach pause fields to debtors table
ALTER TABLE public.debtors 
ADD COLUMN IF NOT EXISTS outreach_paused boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS outreach_paused_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS outreach_paused_reason text;

-- Add outreach pause fields to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS outreach_paused boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS outreach_paused_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS outreach_paused_reason text;

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_debtors_outreach_paused ON public.debtors(outreach_paused) WHERE outreach_paused = true;
CREATE INDEX IF NOT EXISTS idx_invoices_outreach_paused ON public.invoices(outreach_paused) WHERE outreach_paused = true;