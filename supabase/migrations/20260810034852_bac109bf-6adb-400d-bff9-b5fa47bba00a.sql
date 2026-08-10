CREATE OR REPLACE FUNCTION public.refresh_invoice_aging_buckets()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.invoices i
     SET aging_bucket = public.calculate_aging_bucket(i.due_date, i.payment_date)
   WHERE i.due_date IS NOT NULL
     AND i.aging_bucket IS DISTINCT FROM public.calculate_aging_bucket(i.due_date, i.payment_date);
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_invoice_aging_buckets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_invoice_aging_buckets() TO service_role;