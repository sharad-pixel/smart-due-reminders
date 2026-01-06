-- Create contacts table for QuickBooks contact sync
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  debtor_id uuid NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  name text,
  first_name text,
  last_name text,
  email text,
  phone text,
  title text,
  is_primary boolean DEFAULT false,
  source text NOT NULL DEFAULT 'quickbooks',
  external_contact_id text NOT NULL,
  raw jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add unique constraint for upserts
ALTER TABLE public.contacts 
ADD CONSTRAINT contacts_user_debtor_external_unique 
UNIQUE (user_id, debtor_id, external_contact_id);

-- Add helpful indexes
CREATE INDEX idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX idx_contacts_debtor_id ON public.contacts(debtor_id);
CREATE INDEX idx_contacts_email ON public.contacts(email);

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as quickbooks_payments)
CREATE POLICY "Users can view their own contacts"
ON public.contacts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contacts"
ON public.contacts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts"
ON public.contacts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts"
ON public.contacts FOR DELETE
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();