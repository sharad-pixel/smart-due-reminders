-- Fix QuickBooks payment amounts that were incorrectly multiplied by 100
-- The fix: if amount_applied == (raw line Amount * 100), divide by 100

-- First fix quickbooks_payments where we can verify against raw data
UPDATE public.quickbooks_payments
SET amount_applied = (raw->'Line'->0->>'Amount')::numeric
WHERE source = 'quickbooks'
  AND raw IS NOT NULL
  AND (raw->'Line'->0->>'Amount')::numeric IS NOT NULL
  AND amount_applied = ((raw->'Line'->0->>'Amount')::numeric * 100);

-- Also fix invoice_transactions where source_system is quickbooks
-- Match by external_transaction_id pattern and re-sync from quickbooks_payments
UPDATE public.invoice_transactions it
SET amount = qp.amount_applied
FROM public.quickbooks_payments qp
WHERE it.source_system = 'quickbooks'
  AND it.external_transaction_id = 'qb_payment_' || qp.quickbooks_payment_id || '_' || qp.quickbooks_invoice_id
  AND it.amount != qp.amount_applied;