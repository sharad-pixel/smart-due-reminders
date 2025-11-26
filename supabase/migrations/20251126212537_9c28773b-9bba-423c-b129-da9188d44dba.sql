-- Create trigger to auto-assign invoices to workflows on insert
CREATE TRIGGER trigger_auto_assign_invoice_to_workflow
  AFTER INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_invoice_to_workflow();

-- Also trigger on updates when status changes to Open or InPaymentPlan
CREATE TRIGGER trigger_auto_assign_invoice_to_workflow_on_update
  AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW
  WHEN (NEW.status IN ('Open', 'InPaymentPlan') AND OLD.status != NEW.status)
  EXECUTE FUNCTION public.auto_assign_invoice_to_workflow();