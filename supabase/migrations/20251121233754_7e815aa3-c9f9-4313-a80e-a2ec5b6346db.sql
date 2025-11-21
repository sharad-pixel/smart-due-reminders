-- Drop existing enum if we need to update it
DROP TYPE IF EXISTS invoice_status CASCADE;

-- Create updated invoice status enum with all required statuses
CREATE TYPE invoice_status AS ENUM (
  'Open',
  'Paid', 
  'Disputed',
  'Settled',
  'InPaymentPlan',
  'Canceled'
);

-- Create plan type enum
CREATE TYPE plan_type AS ENUM ('free', 'starter', 'growth', 'pro');

-- Create debtor type enum
CREATE TYPE debtor_type AS ENUM ('B2B', 'B2C');

-- Create channel enum for outreach
CREATE TYPE channel_type AS ENUM ('email', 'sms');

-- Create outreach status enum
CREATE TYPE outreach_log_status AS ENUM ('sent', 'failed', 'queued');

-- Create draft status enum
CREATE TYPE draft_status AS ENUM ('pending_approval', 'approved', 'discarded');

-- Create tone enum
CREATE TYPE tone_type AS ENUM ('friendly', 'firm', 'neutral');

-- Extend profiles table to include all user business information
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_type plan_type DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sendgrid_api_key TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS smtp_settings JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twilio_account_sid TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twilio_auth_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twilio_from_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_payment_link_url TEXT;

-- Extend debtors table with additional fields
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS type debtor_type DEFAULT 'B2C';
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS current_balance NUMERIC(10,2) DEFAULT 0;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS tags JSONB;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS crm_account_id TEXT;

-- Update debtors table to make name required after adding
UPDATE debtors SET name = contact_name WHERE name IS NULL;
ALTER TABLE debtors ALTER COLUMN name SET NOT NULL;

-- Drop and recreate invoices table with new status enum and all required fields
DROP TABLE IF EXISTS invoices CASCADE;

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  debtor_id UUID NOT NULL REFERENCES debtors(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status invoice_status DEFAULT 'Open',
  last_contact_date DATE,
  next_contact_date DATE,
  promise_to_pay_date DATE,
  promise_to_pay_amount NUMERIC(10,2),
  payment_date DATE,
  payment_method TEXT,
  external_link TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, invoice_number)
);

-- Enable RLS on invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for invoices
CREATE POLICY "Users can view own invoices" ON invoices 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own invoices" ON invoices 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own invoices" ON invoices 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own invoices" ON invoices 
  FOR DELETE USING (auth.uid() = user_id);

-- Add trigger for invoices updated_at
CREATE TRIGGER update_invoices_updated_at 
  BEFORE UPDATE ON invoices 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Rename outreach_messages to outreach_logs and add required fields
DROP TABLE IF EXISTS outreach_messages CASCADE;

CREATE TABLE outreach_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  debtor_id UUID NOT NULL REFERENCES debtors(id) ON DELETE CASCADE,
  channel channel_type NOT NULL,
  subject TEXT,
  message_body TEXT NOT NULL,
  sent_from TEXT,
  sent_to TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  status outreach_log_status DEFAULT 'queued',
  delivery_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on outreach_logs
ALTER TABLE outreach_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for outreach_logs
CREATE POLICY "Users can view own outreach logs" ON outreach_logs 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own outreach logs" ON outreach_logs 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own outreach logs" ON outreach_logs 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own outreach logs" ON outreach_logs 
  FOR DELETE USING (auth.uid() = user_id);

-- Create ai_workflows table
CREATE TABLE ai_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tone tone_type DEFAULT 'friendly',
  cadence_days JSONB NOT NULL,
  max_settlement_pct INTEGER,
  min_settlement_pct INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on ai_workflows
ALTER TABLE ai_workflows ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for ai_workflows
CREATE POLICY "Users can view own workflows" ON ai_workflows 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own workflows" ON ai_workflows 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own workflows" ON ai_workflows 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own workflows" ON ai_workflows 
  FOR DELETE USING (auth.uid() = user_id);

-- Add trigger for ai_workflows updated_at
CREATE TRIGGER update_ai_workflows_updated_at 
  BEFORE UPDATE ON ai_workflows 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Create ai_drafts table
CREATE TABLE ai_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  channel channel_type NOT NULL,
  subject TEXT,
  message_body TEXT NOT NULL,
  recommended_send_date DATE,
  status draft_status DEFAULT 'pending_approval',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on ai_drafts
ALTER TABLE ai_drafts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for ai_drafts
CREATE POLICY "Users can view own drafts" ON ai_drafts 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own drafts" ON ai_drafts 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own drafts" ON ai_drafts 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own drafts" ON ai_drafts 
  FOR DELETE USING (auth.uid() = user_id);

-- Add trigger for ai_drafts updated_at
CREATE TRIGGER update_ai_drafts_updated_at 
  BEFORE UPDATE ON ai_drafts 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_plan_type ON profiles(plan_type);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);

-- Debtors indexes
CREATE INDEX IF NOT EXISTS idx_debtors_user_id ON debtors(user_id);
CREATE INDEX IF NOT EXISTS idx_debtors_type ON debtors(type);
CREATE INDEX IF NOT EXISTS idx_debtors_email ON debtors(email);
CREATE INDEX IF NOT EXISTS idx_debtors_crm_account_id ON debtors(crm_account_id) WHERE crm_account_id IS NOT NULL;

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_debtor_id ON invoices(debtor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_next_contact_date ON invoices(next_contact_date) WHERE next_contact_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_user_status ON invoices(user_id, status);

-- Outreach logs indexes
CREATE INDEX IF NOT EXISTS idx_outreach_logs_user_id ON outreach_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_outreach_logs_invoice_id ON outreach_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_outreach_logs_debtor_id ON outreach_logs(debtor_id);
CREATE INDEX IF NOT EXISTS idx_outreach_logs_status ON outreach_logs(status);
CREATE INDEX IF NOT EXISTS idx_outreach_logs_sent_at ON outreach_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_outreach_logs_channel ON outreach_logs(channel);

-- AI workflows indexes
CREATE INDEX IF NOT EXISTS idx_ai_workflows_user_id ON ai_workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_workflows_invoice_id ON ai_workflows(invoice_id);
CREATE INDEX IF NOT EXISTS idx_ai_workflows_is_active ON ai_workflows(is_active);

-- AI drafts indexes
CREATE INDEX IF NOT EXISTS idx_ai_drafts_user_id ON ai_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_invoice_id ON ai_drafts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_status ON ai_drafts(status);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_recommended_send_date ON ai_drafts(recommended_send_date) WHERE recommended_send_date IS NOT NULL;

-- Add comment documentation
COMMENT ON TABLE profiles IS 'Extended user profiles with business information and integration credentials';
COMMENT ON TABLE debtors IS 'Customer/debtor records with contact information and balance tracking';
COMMENT ON TABLE invoices IS 'Invoice records with payment tracking and promise-to-pay information';
COMMENT ON TABLE outreach_logs IS 'Log of all outreach communications sent via email or SMS';
COMMENT ON TABLE ai_workflows IS 'AI-powered workflow configurations for automated collection cadences';
COMMENT ON TABLE ai_drafts IS 'AI-generated message drafts awaiting user approval';

COMMENT ON COLUMN profiles.sendgrid_api_key IS 'SendGrid API key for email sending (store encrypted in app layer)';
COMMENT ON COLUMN profiles.twilio_account_sid IS 'Twilio Account SID for SMS (store encrypted in app layer)';
COMMENT ON COLUMN profiles.twilio_auth_token IS 'Twilio Auth Token for SMS (store encrypted in app layer)';
COMMENT ON COLUMN invoices.promise_to_pay_date IS 'Date debtor promised to make payment';
COMMENT ON COLUMN invoices.promise_to_pay_amount IS 'Amount debtor promised to pay';
COMMENT ON COLUMN ai_workflows.cadence_days IS 'JSON array of days to send messages, e.g. [0,3,7,14]';
COMMENT ON COLUMN ai_workflows.max_settlement_pct IS 'Maximum settlement percentage willing to accept';
COMMENT ON COLUMN ai_workflows.min_settlement_pct IS 'Minimum settlement percentage willing to accept';