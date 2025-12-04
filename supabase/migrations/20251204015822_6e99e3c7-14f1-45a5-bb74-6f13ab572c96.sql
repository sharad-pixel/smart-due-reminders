
-- Drop and recreate payment_invoice_links policies safely
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view own payment links" ON public.payment_invoice_links;
    DROP POLICY IF EXISTS "Users can create own payment links" ON public.payment_invoice_links;
    DROP POLICY IF EXISTS "Users can update own payment links" ON public.payment_invoice_links;
    DROP POLICY IF EXISTS "Users can delete own payment links" ON public.payment_invoice_links;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create RLS policies for payment_invoice_links
CREATE POLICY "Users can view own payment links" ON public.payment_invoice_links
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.payments WHERE payments.id = payment_invoice_links.payment_id AND payments.user_id = auth.uid())
);

CREATE POLICY "Users can create own payment links" ON public.payment_invoice_links
FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.payments WHERE payments.id = payment_invoice_links.payment_id AND payments.user_id = auth.uid())
);

CREATE POLICY "Users can update own payment links" ON public.payment_invoice_links
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.payments WHERE payments.id = payment_invoice_links.payment_id AND payments.user_id = auth.uid())
);

CREATE POLICY "Users can delete own payment links" ON public.payment_invoice_links
FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.payments WHERE payments.id = payment_invoice_links.payment_id AND payments.user_id = auth.uid())
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payment_links_payment ON public.payment_invoice_links(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_invoice ON public.payment_invoice_links(invoice_id);
