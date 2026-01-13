-- Add unique constraint for external transaction upserts (for QuickBooks, Stripe, etc.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_transactions_external_unique 
ON public.invoice_transactions (user_id, external_transaction_id) 
WHERE external_transaction_id IS NOT NULL;

-- Backfill existing QuickBooks payments to invoice_transactions
INSERT INTO public.invoice_transactions (
  invoice_id,
  user_id,
  transaction_type,
  amount,
  transaction_date,
  payment_method,
  reference_number,
  source_system,
  external_transaction_id,
  notes,
  metadata
)
SELECT 
  qp.invoice_id,
  qp.user_id,
  'payment',
  qp.amount_applied,
  qp.payment_date,
  qp.payment_method,
  qp.reference_number,
  'quickbooks',
  'qb_payment_' || qp.quickbooks_payment_id || '_' || qp.quickbooks_invoice_id,
  'QuickBooks Payment #' || qp.quickbooks_payment_id,
  jsonb_build_object(
    'quickbooks_payment_id', qp.quickbooks_payment_id,
    'quickbooks_invoice_id', qp.quickbooks_invoice_id,
    'currency', qp.currency
  )
FROM public.quickbooks_payments qp
WHERE qp.invoice_id IS NOT NULL
ON CONFLICT (user_id, external_transaction_id) WHERE external_transaction_id IS NOT NULL
DO UPDATE SET
  amount = EXCLUDED.amount,
  transaction_date = EXCLUDED.transaction_date,
  payment_method = EXCLUDED.payment_method,
  reference_number = EXCLUDED.reference_number,
  metadata = EXCLUDED.metadata;