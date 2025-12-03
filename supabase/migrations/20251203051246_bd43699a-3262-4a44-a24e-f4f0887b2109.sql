-- Create function to trigger first workflow step when invoice enters a new bucket
CREATE OR REPLACE FUNCTION public.trigger_first_workflow_step()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  workflow_record RECORD;
  step_record RECORD;
BEGIN
  -- Only trigger when bucket actually changes and is not null/current
  IF NEW.aging_bucket IS DISTINCT FROM OLD.aging_bucket 
     AND NEW.aging_bucket IS NOT NULL 
     AND NEW.aging_bucket != 'current'
     AND NEW.aging_bucket != 'paid'
     AND NEW.status IN ('Open', 'InPaymentPlan') THEN
    
    -- Find active workflow for this bucket
    SELECT * INTO workflow_record
    FROM collection_workflows
    WHERE aging_bucket = NEW.aging_bucket
      AND is_active = true
      AND (user_id = NEW.user_id OR user_id IS NULL)
    ORDER BY user_id DESC NULLS LAST
    LIMIT 1;
    
    IF workflow_record.id IS NOT NULL THEN
      -- Find first step (step_order = 1) with day_offset = 0
      SELECT * INTO step_record
      FROM collection_workflow_steps
      WHERE workflow_id = workflow_record.id
        AND step_order = 1
        AND day_offset = 0
        AND is_active = true
      LIMIT 1;
      
      IF step_record.id IS NOT NULL THEN
        -- Create a pending draft for immediate sending
        INSERT INTO ai_drafts (
          user_id,
          invoice_id,
          workflow_step_id,
          step_number,
          channel,
          subject,
          message_body,
          status,
          recommended_send_date,
          days_past_due
        ) VALUES (
          NEW.user_id,
          NEW.id,
          step_record.id,
          1,
          step_record.channel,
          step_record.subject_template,
          step_record.body_template,
          'approved', -- Auto-approve for immediate sending
          CURRENT_DATE,
          CURRENT_DATE - NEW.due_date
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on invoices table for bucket changes
DROP TRIGGER IF EXISTS on_invoice_bucket_change ON invoices;
CREATE TRIGGER on_invoice_bucket_change
  AFTER UPDATE OF aging_bucket ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_first_workflow_step();