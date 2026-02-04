-- Add dual approval fields to payment_plans table
ALTER TABLE public.payment_plans 
ADD COLUMN IF NOT EXISTS debtor_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS debtor_approved_by_email TEXT,
ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS admin_approved_by UUID,
ADD COLUMN IF NOT EXISTS requires_dual_approval BOOLEAN DEFAULT true;

-- Add is_on_payment_plan flag to invoices for faster filtering
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS is_on_payment_plan BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_plan_id UUID REFERENCES public.payment_plans(id) ON DELETE SET NULL;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_invoices_payment_plan_id ON public.invoices(payment_plan_id) WHERE payment_plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_on_payment_plan ON public.invoices(is_on_payment_plan) WHERE is_on_payment_plan = true;
CREATE INDEX IF NOT EXISTS idx_payment_plans_debtor_status ON public.payment_plans(debtor_id, status);

-- Add unique constraint to ensure one active payment plan per debtor (excluding cancelled/completed)
-- We use a partial unique index for this
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_payment_plan_per_debtor 
ON public.payment_plans(debtor_id) 
WHERE status NOT IN ('cancelled', 'completed', 'defaulted');

-- Function to sync invoice payment plan flags when a plan is created/updated
CREATE OR REPLACE FUNCTION sync_invoice_payment_plan_flags()
RETURNS TRIGGER AS $$
BEGIN
  -- When a payment plan is created or updated
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Clear old flags if invoice_ids changed
    IF TG_OP = 'UPDATE' AND OLD.invoice_ids IS DISTINCT FROM NEW.invoice_ids THEN
      -- Unset flags for invoices no longer in the plan
      UPDATE public.invoices
      SET is_on_payment_plan = false, payment_plan_id = NULL
      WHERE payment_plan_id = NEW.id
      AND id NOT IN (SELECT jsonb_array_elements_text(COALESCE(NEW.invoice_ids, '[]'::jsonb))::uuid);
    END IF;
    
    -- Set flags for invoices in the active payment plan
    IF NEW.status NOT IN ('cancelled', 'completed', 'defaulted') THEN
      UPDATE public.invoices
      SET is_on_payment_plan = true, payment_plan_id = NEW.id
      WHERE id IN (SELECT jsonb_array_elements_text(COALESCE(NEW.invoice_ids, '[]'::jsonb))::uuid);
    ELSE
      -- If plan is cancelled/completed/defaulted, clear the flags
      UPDATE public.invoices
      SET is_on_payment_plan = false, payment_plan_id = NULL
      WHERE payment_plan_id = NEW.id;
    END IF;
    
    RETURN NEW;
  END IF;
  
  -- When a payment plan is deleted
  IF TG_OP = 'DELETE' THEN
    UPDATE public.invoices
    SET is_on_payment_plan = false, payment_plan_id = NULL
    WHERE payment_plan_id = OLD.id;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for syncing flags
DROP TRIGGER IF EXISTS sync_invoice_payment_plan_flags_trigger ON public.payment_plans;
CREATE TRIGGER sync_invoice_payment_plan_flags_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.payment_plans
FOR EACH ROW EXECUTE FUNCTION sync_invoice_payment_plan_flags();

-- Sync existing payment plans to set flags on invoices
DO $$
DECLARE
  plan_record RECORD;
  invoice_id UUID;
BEGIN
  FOR plan_record IN 
    SELECT id, invoice_ids FROM public.payment_plans 
    WHERE status NOT IN ('cancelled', 'completed', 'defaulted')
  LOOP
    IF plan_record.invoice_ids IS NOT NULL THEN
      FOR invoice_id IN SELECT jsonb_array_elements_text(plan_record.invoice_ids)::uuid
      LOOP
        UPDATE public.invoices 
        SET is_on_payment_plan = true, payment_plan_id = plan_record.id
        WHERE id = invoice_id;
      END LOOP;
    END IF;
  END LOOP;
END $$;