-- Create crm_connections table
CREATE TABLE public.crm_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crm_type TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  instance_url TEXT,
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on crm_connections
ALTER TABLE public.crm_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies for crm_connections
CREATE POLICY "Users can view own CRM connections"
  ON public.crm_connections
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own CRM connections"
  ON public.crm_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own CRM connections"
  ON public.crm_connections
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own CRM connections"
  ON public.crm_connections
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create crm_accounts table
CREATE TABLE public.crm_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crm_type TEXT NOT NULL,
  crm_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  account_number TEXT,
  industry TEXT,
  mrr NUMERIC,
  lifetime_value NUMERIC,
  customer_since DATE,
  health_score TEXT,
  segment TEXT,
  status TEXT,
  owner_name TEXT,
  raw_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, crm_type, crm_account_id)
);

-- Enable RLS on crm_accounts
ALTER TABLE public.crm_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies for crm_accounts
CREATE POLICY "Users can view own CRM accounts"
  ON public.crm_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own CRM accounts"
  ON public.crm_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own CRM accounts"
  ON public.crm_accounts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own CRM accounts"
  ON public.crm_accounts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Update debtors crm_account_id column to be UUID and add foreign key
ALTER TABLE public.debtors
  ALTER COLUMN crm_account_id TYPE UUID USING crm_account_id::uuid,
  ADD CONSTRAINT debtors_crm_account_id_fkey 
    FOREIGN KEY (crm_account_id) 
    REFERENCES public.crm_accounts(id) 
    ON DELETE SET NULL;

-- Add triggers for updated_at
CREATE TRIGGER update_crm_connections_updated_at
  BEFORE UPDATE ON public.crm_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_accounts_updated_at
  BEFORE UPDATE ON public.crm_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
