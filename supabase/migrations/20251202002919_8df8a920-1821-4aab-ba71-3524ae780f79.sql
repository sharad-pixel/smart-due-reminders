-- Create draft templates table (not tied to specific invoices)
CREATE TABLE IF NOT EXISTS public.draft_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workflow_id UUID NOT NULL REFERENCES public.collection_workflows(id) ON DELETE CASCADE,
  workflow_step_id UUID NOT NULL REFERENCES public.collection_workflow_steps(id) ON DELETE CASCADE,
  agent_persona_id UUID REFERENCES public.ai_agent_personas(id),
  aging_bucket TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  subject_template TEXT,
  message_body_template TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  day_offset INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'discarded')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for draft templates
ALTER TABLE public.draft_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own draft templates"
ON public.draft_templates FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own draft templates"
ON public.draft_templates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own draft templates"
ON public.draft_templates FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own draft templates"
ON public.draft_templates FOR DELETE
USING (auth.uid() = user_id);

-- Create sent messages log table to track personalized sends
CREATE TABLE IF NOT EXISTS public.sent_template_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  template_id UUID NOT NULL REFERENCES public.draft_templates(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  debtor_id UUID NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  subject TEXT,
  personalized_body TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  delivery_status TEXT DEFAULT 'sent',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for sent messages
ALTER TABLE public.sent_template_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sent messages"
ON public.sent_template_messages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sent messages"
ON public.sent_template_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add bucket_entered_at to invoices table to track when invoice enters each bucket
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS bucket_entered_at TIMESTAMP WITH TIME ZONE;

-- Create trigger to set bucket_entered_at when aging_bucket changes
CREATE OR REPLACE FUNCTION public.update_bucket_entered_at()
RETURNS TRIGGER AS $$
BEGIN
  -- If aging_bucket changed, update bucket_entered_at
  IF NEW.aging_bucket IS DISTINCT FROM OLD.aging_bucket THEN
    NEW.bucket_entered_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_bucket_entered_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_bucket_entered_at();

-- Set bucket_entered_at for existing invoices (use created_at as fallback)
UPDATE public.invoices
SET bucket_entered_at = COALESCE(bucket_entered_at, created_at)
WHERE bucket_entered_at IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_draft_templates_workflow_bucket ON public.draft_templates(workflow_id, aging_bucket);
CREATE INDEX IF NOT EXISTS idx_draft_templates_status ON public.draft_templates(status);
CREATE INDEX IF NOT EXISTS idx_sent_template_messages_template ON public.sent_template_messages(template_id);
CREATE INDEX IF NOT EXISTS idx_sent_template_messages_invoice ON public.sent_template_messages(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_bucket_entered ON public.invoices(aging_bucket, bucket_entered_at);