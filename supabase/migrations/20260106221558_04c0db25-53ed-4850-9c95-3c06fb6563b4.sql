-- Add smart response fields to existing collection_tasks table
ALTER TABLE collection_tasks
ADD COLUMN IF NOT EXISTS suggested_response_subject TEXT,
ADD COLUMN IF NOT EXISTS suggested_response_body TEXT,
ADD COLUMN IF NOT EXISTS response_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS response_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS response_sent_to TEXT,
ADD COLUMN IF NOT EXISTS response_includes_w9 BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS response_includes_invoice BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS response_includes_portal BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS original_email_body TEXT;

-- Add check constraint for response_status
ALTER TABLE collection_tasks
ADD CONSTRAINT collection_tasks_response_status_check 
CHECK (response_status IN ('pending', 'sent', 'edited_sent', 'ignored', 'not_applicable'));

-- Create smart response settings table
CREATE TABLE IF NOT EXISTS smart_response_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Global toggle
  enabled BOOLEAN DEFAULT true,
  
  -- Per task-type auto-send settings
  -- Values: 'auto_send', 'auto_draft', 'manual'
  w9_request_action TEXT DEFAULT 'auto_draft',
  invoice_request_action TEXT DEFAULT 'auto_draft',
  payment_question_action TEXT DEFAULT 'manual',
  promise_to_pay_action TEXT DEFAULT 'manual',
  payment_plan_request_action TEXT DEFAULT 'manual',
  dispute_action TEXT DEFAULT 'manual',
  callback_request_action TEXT DEFAULT 'manual',
  general_inquiry_action TEXT DEFAULT 'manual',
  already_paid_action TEXT DEFAULT 'manual',
  
  -- Company resources for responses
  w9_document_url TEXT,
  ar_portal_url TEXT,
  company_phone TEXT,
  company_address TEXT,
  
  -- Response customization
  response_tone TEXT DEFAULT 'professional',
  signature_text TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT smart_response_settings_user_unique UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE smart_response_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for smart_response_settings
CREATE POLICY "Users can view own smart response settings" 
  ON smart_response_settings FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own smart response settings" 
  ON smart_response_settings FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own smart response settings" 
  ON smart_response_settings FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own smart response settings" 
  ON smart_response_settings FOR DELETE 
  USING (auth.uid() = user_id);

-- Create task responses tracking table
CREATE TABLE IF NOT EXISTS task_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES collection_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_to TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  was_edited BOOLEAN DEFAULT false,
  original_ai_body TEXT,
  
  resend_email_id TEXT,
  delivery_status TEXT DEFAULT 'sent',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE task_responses ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_responses
CREATE POLICY "Users can view own task responses" 
  ON task_responses FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own task responses" 
  ON task_responses FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_responses_task_id ON task_responses(task_id);
CREATE INDEX IF NOT EXISTS idx_collection_tasks_response_status ON collection_tasks(response_status);
CREATE INDEX IF NOT EXISTS idx_smart_response_settings_user_id ON smart_response_settings(user_id);