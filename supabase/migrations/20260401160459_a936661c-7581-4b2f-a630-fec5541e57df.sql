
CREATE TABLE public.google_sheet_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  connection_id UUID REFERENCES public.drive_connections(id),
  debtor_id UUID REFERENCES public.debtors(id),
  template_type TEXT NOT NULL DEFAULT 'invoice_submission',
  sheet_id TEXT NOT NULL,
  sheet_url TEXT NOT NULL,
  sheet_name TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_synced_at TIMESTAMPTZ,
  rows_synced INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.google_sheet_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sheet templates"
ON public.google_sheet_templates
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR organization_id IN (
  SELECT id FROM organizations WHERE owner_user_id = auth.uid()
) OR public.can_access_account_data(auth.uid(), user_id))
WITH CHECK (user_id = auth.uid() OR organization_id IN (
  SELECT id FROM organizations WHERE owner_user_id = auth.uid()
) OR public.can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Service role full access on sheet templates"
ON public.google_sheet_templates
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
