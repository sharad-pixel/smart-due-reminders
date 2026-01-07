-- Accept legacy lowercase invoice statuses and normalize to canonical casing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'invoice_status'
      AND e.enumlabel = 'canceled'
  ) THEN
    ALTER TYPE public.invoice_status ADD VALUE 'canceled';
  END IF;
END$$;

-- Normalize legacy lowercase enum values to canonical casing
CREATE OR REPLACE FUNCTION public.normalize_invoice_status_enum()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status::text = 'paid' THEN
    NEW.status := 'Paid'::public.invoice_status;
  ELSIF NEW.status::text = 'canceled' THEN
    NEW.status := 'Canceled'::public.invoice_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_invoice_status_enum ON public.invoices;
CREATE TRIGGER normalize_invoice_status_enum
BEFORE INSERT OR UPDATE OF status ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.normalize_invoice_status_enum();
