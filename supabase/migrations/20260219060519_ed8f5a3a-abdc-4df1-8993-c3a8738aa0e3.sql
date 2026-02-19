
-- Step 1: Re-create the trigger on the invoices table
-- (The function already exists, but the trigger was never attached)
CREATE OR REPLACE TRIGGER trigger_update_debtor_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_debtor_balance();

-- Step 2: One-time backfill to fix all stale debtor balances
UPDATE public.debtors d
SET
  current_balance = sub.total_outstanding,
  total_open_balance = sub.total_outstanding,
  open_invoices_count = sub.open_count
FROM (
  SELECT
    debtor_id,
    COALESCE(SUM(amount_outstanding), 0) AS total_outstanding,
    COUNT(*) AS open_count
  FROM public.invoices
  WHERE status IN ('Open', 'InPaymentPlan', 'PartiallyPaid')
  GROUP BY debtor_id
) sub
WHERE d.id = sub.debtor_id;

-- Step 3: Zero out debtors with NO open invoices (those with stale non-zero balances)
UPDATE public.debtors d
SET
  current_balance = 0,
  total_open_balance = 0,
  open_invoices_count = 0
WHERE d.id NOT IN (
  SELECT DISTINCT debtor_id
  FROM public.invoices
  WHERE status IN ('Open', 'InPaymentPlan', 'PartiallyPaid')
)
AND (d.current_balance != 0 OR d.open_invoices_count != 0);
