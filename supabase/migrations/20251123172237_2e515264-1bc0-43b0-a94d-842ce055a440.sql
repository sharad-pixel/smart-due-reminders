-- Function to update debtor balances
CREATE OR REPLACE FUNCTION update_debtor_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Update the debtor's current_balance and total_open_balance
  UPDATE debtors
  SET 
    current_balance = (
      SELECT COALESCE(SUM(amount), 0)
      FROM invoices
      WHERE debtor_id = COALESCE(NEW.debtor_id, OLD.debtor_id)
        AND status IN ('Open', 'InPaymentPlan')
    ),
    total_open_balance = (
      SELECT COALESCE(SUM(amount), 0)
      FROM invoices
      WHERE debtor_id = COALESCE(NEW.debtor_id, OLD.debtor_id)
        AND status IN ('Open', 'InPaymentPlan')
    ),
    open_invoices_count = (
      SELECT COUNT(*)
      FROM invoices
      WHERE debtor_id = COALESCE(NEW.debtor_id, OLD.debtor_id)
        AND status IN ('Open', 'InPaymentPlan')
    )
  WHERE id = COALESCE(NEW.debtor_id, OLD.debtor_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for invoice inserts and updates
DROP TRIGGER IF EXISTS update_debtor_balance_on_invoice_change ON invoices;
CREATE TRIGGER update_debtor_balance_on_invoice_change
AFTER INSERT OR UPDATE OR DELETE ON invoices
FOR EACH ROW
EXECUTE FUNCTION update_debtor_balance();

-- Recalculate all existing debtor balances
UPDATE debtors d
SET 
  current_balance = COALESCE((
    SELECT SUM(i.amount)
    FROM invoices i
    WHERE i.debtor_id = d.id
      AND i.status IN ('Open', 'InPaymentPlan')
  ), 0),
  total_open_balance = COALESCE((
    SELECT SUM(i.amount)
    FROM invoices i
    WHERE i.debtor_id = d.id
      AND i.status IN ('Open', 'InPaymentPlan')
  ), 0),
  open_invoices_count = COALESCE((
    SELECT COUNT(*)
    FROM invoices i
    WHERE i.debtor_id = d.id
      AND i.status IN ('Open', 'InPaymentPlan')
  ), 0);