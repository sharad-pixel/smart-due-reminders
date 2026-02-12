CREATE OR REPLACE FUNCTION public.update_debtor_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE debtors
  SET 
    current_balance = (
      SELECT COALESCE(SUM(amount_outstanding), 0)
      FROM invoices
      WHERE debtor_id = COALESCE(NEW.debtor_id, OLD.debtor_id)
        AND status IN ('Open', 'InPaymentPlan', 'PartiallyPaid')
    ),
    total_open_balance = (
      SELECT COALESCE(SUM(amount_outstanding), 0)
      FROM invoices
      WHERE debtor_id = COALESCE(NEW.debtor_id, OLD.debtor_id)
        AND status IN ('Open', 'InPaymentPlan', 'PartiallyPaid')
    ),
    open_invoices_count = (
      SELECT COUNT(*)
      FROM invoices
      WHERE debtor_id = COALESCE(NEW.debtor_id, OLD.debtor_id)
        AND status IN ('Open', 'InPaymentPlan', 'PartiallyPaid')
    )
  WHERE id = COALESCE(NEW.debtor_id, OLD.debtor_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;