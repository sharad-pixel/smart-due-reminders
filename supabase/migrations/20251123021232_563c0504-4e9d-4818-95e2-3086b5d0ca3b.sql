-- Create collection_activities table
CREATE TABLE public.collection_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  debtor_id UUID NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  
  -- Activity metadata
  activity_type TEXT NOT NULL, -- outbound_email, outbound_sms, inbound_email, inbound_sms, phone_call, note
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'phone', 'note')),
  
  -- Content
  subject TEXT,
  message_body TEXT NOT NULL,
  response_message TEXT, -- For inbound activities
  
  -- Tracking timestamps
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE,
  
  -- Links to other systems
  linked_draft_id UUID REFERENCES public.ai_drafts(id) ON DELETE SET NULL,
  linked_outreach_log_id UUID REFERENCES public.outreach_logs(id) ON DELETE SET NULL,
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_collection_activities_user_id ON public.collection_activities(user_id);
CREATE INDEX idx_collection_activities_debtor_id ON public.collection_activities(debtor_id);
CREATE INDEX idx_collection_activities_invoice_id ON public.collection_activities(invoice_id);
CREATE INDEX idx_collection_activities_created_at ON public.collection_activities(created_at DESC);
CREATE INDEX idx_collection_activities_direction ON public.collection_activities(direction);

-- Enable RLS
ALTER TABLE public.collection_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own activities"
  ON public.collection_activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own activities"
  ON public.collection_activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activities"
  ON public.collection_activities FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own activities"
  ON public.collection_activities FOR DELETE
  USING (auth.uid() = user_id);

-- Create collection_outcomes table
CREATE TABLE public.collection_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  debtor_id UUID NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES public.collection_activities(id) ON DELETE SET NULL,
  
  -- Outcome information
  outcome_type TEXT NOT NULL, -- paid, promise_to_pay, dispute, no_response, callback_requested, need_info, escalated, partial_payment
  outcome_details JSONB DEFAULT '{}'::jsonb,
  
  -- Financial details
  amount NUMERIC,
  payment_date DATE,
  promise_to_pay_date DATE,
  promise_to_pay_amount NUMERIC,
  
  -- Dispute details
  dispute_reason TEXT,
  dispute_status TEXT, -- open, investigating, resolved
  
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_collection_outcomes_user_id ON public.collection_outcomes(user_id);
CREATE INDEX idx_collection_outcomes_debtor_id ON public.collection_outcomes(debtor_id);
CREATE INDEX idx_collection_outcomes_invoice_id ON public.collection_outcomes(invoice_id);
CREATE INDEX idx_collection_outcomes_activity_id ON public.collection_outcomes(activity_id);
CREATE INDEX idx_collection_outcomes_outcome_type ON public.collection_outcomes(outcome_type);
CREATE INDEX idx_collection_outcomes_created_at ON public.collection_outcomes(created_at DESC);

-- Enable RLS
ALTER TABLE public.collection_outcomes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own outcomes"
  ON public.collection_outcomes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own outcomes"
  ON public.collection_outcomes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own outcomes"
  ON public.collection_outcomes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own outcomes"
  ON public.collection_outcomes FOR DELETE
  USING (auth.uid() = user_id);

-- Create collection_tasks table
CREATE TABLE public.collection_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  debtor_id UUID NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES public.collection_activities(id) ON DELETE SET NULL,
  
  -- Task information
  task_type TEXT NOT NULL, -- w9_request, payment_plan_needed, incorrect_po, dispute_charges, invoice_copy_request, billing_address_update, payment_method_update, service_not_delivered, overpayment_inquiry, paid_verification, extension_request, callback_required
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  
  -- Task details
  summary TEXT NOT NULL,
  details TEXT,
  ai_reasoning TEXT, -- Why AI extracted this task
  recommended_action TEXT, -- What to do next
  
  -- Assignment
  assigned_to UUID, -- Could be a user_id or null
  assigned_persona TEXT, -- Sam, James, Katy, Troy, Gotti
  
  -- Dates
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_collection_tasks_user_id ON public.collection_tasks(user_id);
CREATE INDEX idx_collection_tasks_debtor_id ON public.collection_tasks(debtor_id);
CREATE INDEX idx_collection_tasks_invoice_id ON public.collection_tasks(invoice_id);
CREATE INDEX idx_collection_tasks_activity_id ON public.collection_tasks(activity_id);
CREATE INDEX idx_collection_tasks_task_type ON public.collection_tasks(task_type);
CREATE INDEX idx_collection_tasks_status ON public.collection_tasks(status);
CREATE INDEX idx_collection_tasks_priority ON public.collection_tasks(priority);
CREATE INDEX idx_collection_tasks_due_date ON public.collection_tasks(due_date);
CREATE INDEX idx_collection_tasks_created_at ON public.collection_tasks(created_at DESC);

-- Enable RLS
ALTER TABLE public.collection_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own tasks"
  ON public.collection_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tasks"
  ON public.collection_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON public.collection_tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
  ON public.collection_tasks FOR DELETE
  USING (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_collection_activities_updated_at
  BEFORE UPDATE ON public.collection_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_collection_outcomes_updated_at
  BEFORE UPDATE ON public.collection_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_collection_tasks_updated_at
  BEFORE UPDATE ON public.collection_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();