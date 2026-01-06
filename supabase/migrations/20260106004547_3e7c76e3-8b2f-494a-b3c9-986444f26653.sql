-- Create stripe_sync_log table to match quickbooks_sync_log structure
CREATE TABLE IF NOT EXISTS public.stripe_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('invoices', 'payments', 'full')),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  records_synced INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  errors JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'partial', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stripe_sync_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own stripe sync logs"
  ON public.stripe_sync_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stripe sync logs"
  ON public.stripe_sync_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stripe sync logs"
  ON public.stripe_sync_log FOR UPDATE
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_stripe_sync_log_user_id ON public.stripe_sync_log(user_id);
CREATE INDEX idx_stripe_sync_log_started_at ON public.stripe_sync_log(started_at DESC);