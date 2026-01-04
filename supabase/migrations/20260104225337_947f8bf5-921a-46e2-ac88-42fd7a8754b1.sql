-- Create outreach_errors table for tracking failed draft generation
CREATE TABLE IF NOT EXISTS public.outreach_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES public.ai_workflows(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  step_number INTEGER,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.outreach_errors ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users to view their own errors
CREATE POLICY "Users can view their own outreach errors"
  ON public.outreach_errors
  FOR SELECT
  USING (user_id = auth.uid() OR public.can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Users can insert their own outreach errors"
  ON public.outreach_errors
  FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Users can update their own outreach errors"
  ON public.outreach_errors
  FOR UPDATE
  USING (user_id = auth.uid() OR public.can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Users can delete their own outreach errors"
  ON public.outreach_errors
  FOR DELETE
  USING (user_id = auth.uid() OR public.can_access_account_data(auth.uid(), user_id));

-- Create index for faster lookups
CREATE INDEX idx_outreach_errors_user_id ON public.outreach_errors(user_id);
CREATE INDEX idx_outreach_errors_invoice_id ON public.outreach_errors(invoice_id);
CREATE INDEX idx_outreach_errors_resolved ON public.outreach_errors(resolved_at) WHERE resolved_at IS NULL;

-- Fix all existing ai_workflows with empty cadence_days arrays
-- This is a one-time migration to fix broken data
UPDATE public.ai_workflows aw
SET cadence_days = COALESCE(
  (
    SELECT jsonb_agg(cws.day_offset ORDER BY cws.step_order)
    FROM public.collection_workflows cw
    JOIN public.collection_workflow_steps cws ON cws.workflow_id = cw.id
    JOIN public.invoices i ON i.id = aw.invoice_id
    WHERE cw.is_active = true
      AND cw.aging_bucket = COALESCE(i.aging_bucket, 'dpd_1_30')
      AND (cw.user_id = aw.user_id OR cw.user_id IS NULL)
  ),
  '[0, 3, 7, 14, 21]'::jsonb
)
WHERE aw.cadence_days = '[]'::jsonb OR aw.cadence_days IS NULL;

-- Add a trigger to prevent empty cadence_days on insert/update
CREATE OR REPLACE FUNCTION public.validate_cadence_days()
RETURNS TRIGGER AS $$
BEGIN
  -- If cadence_days is empty or null, set a default
  IF NEW.cadence_days IS NULL OR NEW.cadence_days = '[]'::jsonb THEN
    NEW.cadence_days := '[0, 3, 7, 14, 21]'::jsonb;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for ai_workflows
DROP TRIGGER IF EXISTS ensure_cadence_days_not_empty ON public.ai_workflows;
CREATE TRIGGER ensure_cadence_days_not_empty
  BEFORE INSERT OR UPDATE ON public.ai_workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_cadence_days();