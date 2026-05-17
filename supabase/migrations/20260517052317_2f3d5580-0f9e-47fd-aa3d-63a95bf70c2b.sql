
ALTER TABLE public.asc606_credit_ledger
  DROP CONSTRAINT IF EXISTS asc606_credit_ledger_kind_check;

ALTER TABLE public.asc606_credit_ledger
  ADD CONSTRAINT asc606_credit_ledger_kind_check
  CHECK (kind = ANY (ARRAY[
    'purchase'::text,
    'consume'::text,
    'overage_accrue'::text,
    'overage_invoice'::text,
    'overage_payment'::text,
    'refund'::text,
    'adjustment'::text,
    'compliance_doc_indexing'::text
  ]));
