
-- Add persona_id and template approval columns to collection_workflows
ALTER TABLE collection_workflows 
ADD COLUMN IF NOT EXISTS persona_id UUID REFERENCES ai_agent_personas(id),
ADD COLUMN IF NOT EXISTS is_template_approved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS template_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS template_approved_by UUID;

-- Add step approval columns to collection_workflow_steps
ALTER TABLE collection_workflow_steps
ADD COLUMN IF NOT EXISTS is_step_approved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS step_approved_at TIMESTAMP WITH TIME ZONE;

-- Add auto_approved column to ai_drafts
ALTER TABLE ai_drafts
ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN DEFAULT false;
