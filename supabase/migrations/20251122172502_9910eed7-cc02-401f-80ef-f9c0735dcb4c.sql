-- Create branding_settings table for white-label customization
CREATE TABLE IF NOT EXISTS public.branding_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  from_name TEXT,
  from_email TEXT,
  reply_to_email TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#000000',
  email_footer TEXT,
  email_signature TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create collection_workflows table
CREATE TABLE IF NOT EXISTS public.collection_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL,  -- NULL = global default; non-null = tenant-specific
  name TEXT NOT NULL,
  description TEXT,
  aging_bucket TEXT NOT NULL CHECK (aging_bucket IN ('current','dpd_1_30','dpd_31_60','dpd_61_90','dpd_91_120','dpd_120_plus')),
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  is_locked BOOLEAN DEFAULT FALSE,  -- for protected global defaults
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create collection_workflow_steps table
CREATE TABLE IF NOT EXISTS public.collection_workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.collection_workflows(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  label TEXT NOT NULL,
  day_offset INT NOT NULL,  -- days from due date or from previous step
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('relative_to_due','relative_to_last_step')),
  channel channel_type NOT NULL,  -- reuse existing enum
  ai_template_type TEXT NOT NULL,  -- 'reminder','firm_notice','high_risk_escalation'
  subject_template TEXT,
  body_template TEXT NOT NULL,
  sms_template TEXT,
  requires_review BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add workflow_step_id to ai_drafts if column doesn't exist
ALTER TABLE public.ai_drafts 
ADD COLUMN IF NOT EXISTS workflow_step_id UUID REFERENCES public.collection_workflow_steps(id) ON DELETE SET NULL;

-- Enable RLS on new tables
ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_workflow_steps ENABLE ROW LEVEL SECURITY;

-- RLS policies for branding_settings
CREATE POLICY "Users can view own branding settings"
  ON public.branding_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own branding settings"
  ON public.branding_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own branding settings"
  ON public.branding_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for collection_workflows
CREATE POLICY "Users can view global and own workflows"
  ON public.collection_workflows FOR SELECT
  USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can create own workflows"
  ON public.collection_workflows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workflows"
  ON public.collection_workflows FOR UPDATE
  USING (auth.uid() = user_id AND is_locked = FALSE);

CREATE POLICY "Users can delete own workflows"
  ON public.collection_workflows FOR DELETE
  USING (auth.uid() = user_id AND is_locked = FALSE);

-- RLS policies for collection_workflow_steps
CREATE POLICY "Users can view steps of accessible workflows"
  ON public.collection_workflow_steps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.collection_workflows
      WHERE id = workflow_id
      AND (user_id IS NULL OR user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage steps of own workflows"
  ON public.collection_workflow_steps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.collection_workflows
      WHERE id = workflow_id
      AND user_id = auth.uid()
      AND is_locked = FALSE
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflows_user_bucket ON public.collection_workflows(user_id, aging_bucket);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow ON public.collection_workflow_steps(workflow_id, step_order);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_workflow_step ON public.ai_drafts(workflow_step_id);

-- Trigger for updated_at columns
CREATE TRIGGER update_branding_settings_updated_at
  BEFORE UPDATE ON public.branding_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_collection_workflows_updated_at
  BEFORE UPDATE ON public.collection_workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_collection_workflow_steps_updated_at
  BEFORE UPDATE ON public.collection_workflow_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();