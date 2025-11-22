-- Function to automatically assign invoice to workflow based on aging bucket
CREATE OR REPLACE FUNCTION auto_assign_invoice_to_workflow()
RETURNS TRIGGER AS $$
DECLARE
  days_past_due INTEGER;
  age_bucket TEXT;
  workflow_record RECORD;
BEGIN
  -- Calculate days past due
  days_past_due := CURRENT_DATE - NEW.due_date;
  
  -- Determine aging bucket
  IF days_past_due < 0 THEN
    age_bucket := 'current';
  ELSIF days_past_due <= 30 THEN
    age_bucket := 'dpd_1_30';
  ELSIF days_past_due <= 60 THEN
    age_bucket := 'dpd_31_60';
  ELSIF days_past_due <= 90 THEN
    age_bucket := 'dpd_61_90';
  ELSIF days_past_due <= 120 THEN
    age_bucket := 'dpd_91_120';
  ELSE
    age_bucket := 'dpd_121_plus';
  END IF;
  
  -- Find the active workflow for this aging bucket and user
  SELECT * INTO workflow_record
  FROM collection_workflows
  WHERE aging_bucket = age_bucket
    AND is_active = true
    AND (user_id = NEW.user_id OR user_id IS NULL)
  ORDER BY user_id DESC NULLS LAST
  LIMIT 1;
  
  -- If workflow exists, create ai_workflow entry
  IF workflow_record.id IS NOT NULL THEN
    INSERT INTO ai_workflows (
      invoice_id,
      user_id,
      is_active,
      cadence_days,
      tone
    ) VALUES (
      NEW.id,
      NEW.user_id,
      true,
      '[]'::jsonb,
      'friendly'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto-assignment on invoice creation
DROP TRIGGER IF EXISTS trigger_auto_assign_workflow ON invoices;
CREATE TRIGGER trigger_auto_assign_workflow
  AFTER INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_invoice_to_workflow();