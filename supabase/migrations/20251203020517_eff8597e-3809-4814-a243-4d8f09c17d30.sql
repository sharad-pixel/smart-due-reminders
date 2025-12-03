-- Create messages table for inbound/outbound message storage
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'inbound',
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  debtor_id UUID REFERENCES public.debtors(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT,
  html_body TEXT,
  text_body TEXT,
  raw_body TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users can view their own messages
CREATE POLICY "Users can view own messages"
ON public.messages
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert own messages
CREATE POLICY "Users can insert own messages"
ON public.messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Service role can insert (for webhooks)
CREATE POLICY "Service role can insert messages"
ON public.messages
FOR INSERT
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_messages_invoice_id ON public.messages(invoice_id);
CREATE INDEX idx_messages_debtor_id ON public.messages(debtor_id);
CREATE INDEX idx_messages_user_id ON public.messages(user_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);