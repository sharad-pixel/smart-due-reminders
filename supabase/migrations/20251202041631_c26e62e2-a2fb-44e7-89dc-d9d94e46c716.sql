
-- Update aging_bucket for all existing invoices
UPDATE invoices
SET 
  aging_bucket = calculate_aging_bucket(due_date, payment_date),
  bucket_entered_at = CASE 
    WHEN bucket_entered_at IS NULL THEN now()
    ELSE bucket_entered_at
  END
WHERE aging_bucket IS NULL AND status IN ('Open', 'InPaymentPlan');

-- Ensure trigger exists to automatically calculate aging_bucket
DROP TRIGGER IF EXISTS set_invoice_aging_bucket ON invoices;

CREATE OR REPLACE FUNCTION update_invoice_aging_bucket()
RETURNS TRIGGER AS $$
BEGIN
  NEW.aging_bucket := calculate_aging_bucket(NEW.due_date, NEW.payment_date);
  
  -- Set bucket_entered_at if bucket changed
  IF NEW.aging_bucket IS DISTINCT FROM OLD.aging_bucket THEN
    NEW.bucket_entered_at := now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invoice_aging_bucket
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_aging_bucket();
