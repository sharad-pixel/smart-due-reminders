-- Create debtor portal access tokens table for magic link authentication
CREATE TABLE public.debtor_portal_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast token lookups
CREATE INDEX idx_debtor_portal_tokens_token ON public.debtor_portal_tokens(token);
CREATE INDEX idx_debtor_portal_tokens_email ON public.debtor_portal_tokens(email);

-- Enable RLS but allow public access for token verification (edge function will handle security)
ALTER TABLE public.debtor_portal_tokens ENABLE ROW LEVEL SECURITY;

-- Allow reading tokens for verification (edge function uses service role for creation)
CREATE POLICY "Allow public token verification"
ON public.debtor_portal_tokens
FOR SELECT
USING (true);

-- Add email field to debtors table if not present for contact matching
-- First check if primary_email exists, if not we'll use contacts table

-- Create a view to get debtor emails from contacts
CREATE OR REPLACE VIEW public.debtor_contact_emails AS
SELECT DISTINCT
  d.id as debtor_id,
  d.user_id,
  c.email
FROM public.debtors d
JOIN public.contacts c ON c.debtor_id = d.id
WHERE c.email IS NOT NULL AND c.email != '';