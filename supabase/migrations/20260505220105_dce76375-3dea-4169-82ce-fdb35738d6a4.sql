
CREATE TABLE IF NOT EXISTS public.broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID NOT NULL REFERENCES public.email_broadcasts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  unsubscribe_token TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT broadcast_recipients_unique UNIQUE (broadcast_id, email)
);

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_pending
  ON public.broadcast_recipients (broadcast_id, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_status
  ON public.broadcast_recipients (status);

ALTER TABLE public.broadcast_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view broadcast recipients"
  ON public.broadcast_recipients FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can manage broadcast recipients"
  ON public.broadcast_recipients FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE TRIGGER update_broadcast_recipients_updated_at
  BEFORE UPDATE ON public.broadcast_recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
