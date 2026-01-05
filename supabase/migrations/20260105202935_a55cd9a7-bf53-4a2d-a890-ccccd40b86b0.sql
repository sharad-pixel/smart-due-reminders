-- Fix function search path security warning
CREATE OR REPLACE FUNCTION public.generate_debtor_raid()
RETURNS TRIGGER 
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.reference_id IS NULL OR NEW.reference_id = '' THEN
    NEW.reference_id := 'RAID-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;