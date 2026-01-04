-- Create stripe_integrations table to store connection status and sync settings
CREATE TABLE public.stripe_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  is_connected BOOLEAN NOT NULL DEFAULT false,
  stripe_account_id TEXT,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_frequency TEXT DEFAULT 'daily',
  auto_sync_enabled BOOLEAN DEFAULT true,
  sync_status TEXT DEFAULT 'idle',
  last_sync_error TEXT,
  invoices_synced_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.stripe_integrations ENABLE ROW LEVEL SECURITY;

-- Users can manage their own integration
CREATE POLICY "Users can view own stripe integration"
  ON public.stripe_integrations FOR SELECT
  USING (auth.uid() = user_id OR can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Users can insert own stripe integration"
  ON public.stripe_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stripe integration"
  ON public.stripe_integrations FOR UPDATE
  USING (auth.uid() = user_id OR can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Users can delete own stripe integration"
  ON public.stripe_integrations FOR DELETE
  USING (auth.uid() = user_id);

-- Add stripe_invoice_id column to invoices table to track synced invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_hosted_url TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id ON public.invoices(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_stripe_integrations_user_id ON public.stripe_integrations(user_id);