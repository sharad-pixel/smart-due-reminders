CREATE TABLE IF NOT EXISTS public.ocr_invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  amount numeric(12,2) NOT NULL,
  page_count integer NOT NULL DEFAULT 0,
  event_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  hosted_invoice_url text,
  error text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ocr_invoice_payments_account ON public.ocr_invoice_payments(account_id, created_at DESC);

ALTER TABLE public.ocr_invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ocr_invoice_payments_select" ON public.ocr_invoice_payments;
CREATE POLICY "ocr_invoice_payments_select" ON public.ocr_invoice_payments
  FOR SELECT USING (
    auth.uid() = user_id
    OR (account_id IS NOT NULL AND can_access_account_data(auth.uid(), account_id))
  );

ALTER TABLE public.ocr_usage_events ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.ocr_invoice_payments(id) ON DELETE SET NULL;