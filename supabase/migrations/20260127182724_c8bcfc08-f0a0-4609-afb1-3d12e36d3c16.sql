-- Add unsubscribe tracking table for marketing emails
CREATE TABLE IF NOT EXISTS public.email_unsubscribes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  unsubscribed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source TEXT DEFAULT 'marketing', -- 'marketing', 'all'
  reason TEXT,
  token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex')
);

-- Enable RLS
ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- Public can insert (for unsubscribe requests)
CREATE POLICY "Anyone can unsubscribe"
  ON public.email_unsubscribes
  FOR INSERT
  WITH CHECK (true);

-- Only admins can view/manage
CREATE POLICY "Admins can view unsubscribes"
  ON public.email_unsubscribes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Add unsubscribe token to marketing_leads
ALTER TABLE public.marketing_leads 
  ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex');

-- Index for fast unsubscribe lookups
CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_email ON public.email_unsubscribes(email);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_unsubscribe_token ON public.marketing_leads(unsubscribe_token);