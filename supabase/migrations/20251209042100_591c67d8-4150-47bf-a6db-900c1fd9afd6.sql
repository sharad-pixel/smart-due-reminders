-- Create table for additional debtor contacts
CREATE TABLE public.debtor_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  debtor_id UUID NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  outreach_enabled BOOLEAN NOT NULL DEFAULT true,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.debtor_contacts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own and team contacts"
  ON public.debtor_contacts
  FOR SELECT
  USING (can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Users can create contacts for own or team account"
  ON public.debtor_contacts
  FOR INSERT
  WITH CHECK (user_id = get_effective_account_id(auth.uid()));

CREATE POLICY "Users can update own and team contacts"
  ON public.debtor_contacts
  FOR UPDATE
  USING (can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Users can delete own and team contacts"
  ON public.debtor_contacts
  FOR DELETE
  USING (can_access_account_data(auth.uid(), user_id));

-- Create updated_at trigger
CREATE TRIGGER update_debtor_contacts_updated_at
  BEFORE UPDATE ON public.debtor_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_debtor_contacts_debtor_id ON public.debtor_contacts(debtor_id);
CREATE INDEX idx_debtor_contacts_user_id ON public.debtor_contacts(user_id);