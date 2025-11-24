-- Update the debtor reference ID trigger to use RCPLY prefix instead of DEB
DROP TRIGGER IF EXISTS set_debtor_reference_id_trigger ON public.debtors;

CREATE OR REPLACE FUNCTION public.set_debtor_reference_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reference_id IS NULL OR NEW.reference_id = '' THEN
    NEW.reference_id := public.generate_reference_id('RCPLY', 'debtors');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_debtor_reference_id_trigger
  BEFORE INSERT ON public.debtors
  FOR EACH ROW
  EXECUTE FUNCTION public.set_debtor_reference_id();