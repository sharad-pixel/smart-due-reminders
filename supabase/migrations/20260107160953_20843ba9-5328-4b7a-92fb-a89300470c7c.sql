-- Add legacy lowercase invoice statuses (from integrations) and normalize to canonical casing
DO $$
DECLARE
  v text;
  legacy_values text[] := ARRAY[
    'open',
    'paid',
    'canceled',
    'cancelled',
    'voided',
    'void',
    'disputed',
    'settled',
    'inpaymentplan',
    'partiallypaid',
    'partially_paid',
    'finalinternalcollections'
  ];
BEGIN
  FOREACH v IN ARRAY legacy_values LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE n.nspname = 'public'
        AND t.typname = 'invoice_status'
        AND e.enumlabel = v
    ) THEN
      EXECUTE format('ALTER TYPE public.invoice_status ADD VALUE %L', v);
    END IF;
  END LOOP;
END$$;

-- Normalize any legacy lowercase enum values to canonical casing
CREATE OR REPLACE FUNCTION public.normalize_invoice_status_enum()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s text;
BEGIN
  s := lower(NEW.status::text);

  IF s = 'open' THEN
    NEW.status := 'Open'::public.invoice_status;
  ELSIF s = 'paid' THEN
    NEW.status := 'Paid'::public.invoice_status;
  ELSIF s IN ('canceled', 'cancelled') THEN
    NEW.status := 'Canceled'::public.invoice_status;
  ELSIF s IN ('voided', 'void') THEN
    NEW.status := 'Voided'::public.invoice_status;
  ELSIF s = 'disputed' THEN
    NEW.status := 'Disputed'::public.invoice_status;
  ELSIF s = 'settled' THEN
    NEW.status := 'Settled'::public.invoice_status;
  ELSIF s = 'inpaymentplan' THEN
    NEW.status := 'InPaymentPlan'::public.invoice_status;
  ELSIF s IN ('partiallypaid', 'partially_paid') THEN
    NEW.status := 'PartiallyPaid'::public.invoice_status;
  ELSIF s = 'finalinternalcollections' THEN
    NEW.status := 'FinalInternalCollections'::public.invoice_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_invoice_status_enum ON public.invoices;
CREATE TRIGGER normalize_invoice_status_enum
BEFORE INSERT OR UPDATE OF status ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.normalize_invoice_status_enum();
