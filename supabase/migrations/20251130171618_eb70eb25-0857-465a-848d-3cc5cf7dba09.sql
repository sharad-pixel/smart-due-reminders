-- Create inbound_emails table for platform-wide email storage
CREATE TABLE IF NOT EXISTS public.inbound_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Event metadata
  event_type TEXT NOT NULL,
  raw_payload JSONB NOT NULL,
  
  -- Core email fields
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_emails JSONB NOT NULL,
  cc_emails JSONB,
  bcc_emails JSONB,
  subject TEXT NOT NULL,
  text_body TEXT,
  html_body TEXT,
  message_id TEXT NOT NULL,
  email_id TEXT,
  
  -- Linking fields
  debtor_id UUID REFERENCES public.debtors(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  
  -- Processing fields
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'linked', 'processed', 'error')),
  error_message TEXT,
  
  -- AI fields
  ai_summary TEXT,
  ai_actions JSONB,
  ai_processed_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX idx_inbound_emails_user_created ON public.inbound_emails(user_id, created_at DESC);
CREATE INDEX idx_inbound_emails_message_id ON public.inbound_emails(message_id);
CREATE INDEX idx_inbound_emails_from_email ON public.inbound_emails(from_email);
CREATE INDEX idx_inbound_emails_status ON public.inbound_emails(status);
CREATE INDEX idx_inbound_emails_debtor ON public.inbound_emails(debtor_id) WHERE debtor_id IS NOT NULL;
CREATE INDEX idx_inbound_emails_invoice ON public.inbound_emails(invoice_id) WHERE invoice_id IS NOT NULL;

-- Add trigger for updated_at
CREATE TRIGGER update_inbound_emails_updated_at
  BEFORE UPDATE ON public.inbound_emails
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.inbound_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own inbound emails"
  ON public.inbound_emails
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own inbound emails"
  ON public.inbound_emails
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own inbound emails"
  ON public.inbound_emails
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert inbound emails"
  ON public.inbound_emails
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update inbound emails"
  ON public.inbound_emails
  FOR UPDATE
  USING (true);