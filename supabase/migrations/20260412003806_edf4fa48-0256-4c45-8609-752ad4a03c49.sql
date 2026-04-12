CREATE TABLE public.ar_introduction_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  debtor_id UUID NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  debtor_email TEXT NOT NULL,
  business_name TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(debtor_id, user_id)
);

ALTER TABLE public.ar_introduction_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own introduction emails"
  ON public.ar_introduction_emails FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own introduction emails"
  ON public.ar_introduction_emails FOR INSERT
  WITH CHECK (auth.uid() = user_id);