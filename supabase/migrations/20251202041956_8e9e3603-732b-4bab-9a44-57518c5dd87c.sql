
-- Fix security warning: Set search_path for the function
CREATE OR REPLACE FUNCTION update_invoice_aging_bucket()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.aging_bucket := calculate_aging_bucket(NEW.due_date, NEW.payment_date);
  
  -- Set bucket_entered_at if bucket changed
  IF NEW.aging_bucket IS DISTINCT FROM OLD.aging_bucket THEN
    NEW.bucket_entered_at := now();
  END IF;
  
  RETURN NEW;
END;
$$;
