
CREATE TABLE public.contract_custom_triggers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  import_id UUID NOT NULL REFERENCES public.live_contract_imports(id) ON DELETE CASCADE,
  created_by UUID,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('date_offset','amount_threshold','field_change')),
  source_field TEXT NOT NULL,
  offset_days INTEGER,
  comparator TEXT CHECK (comparator IN ('gt','lt','eq','gte','lte','changed')),
  threshold_value NUMERIC(18,2),
  channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email','both')),
  notify_emails TEXT[] NOT NULL DEFAULT '{}',
  message TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cct_import ON public.contract_custom_triggers(import_id);
CREATE INDEX idx_cct_account_active ON public.contract_custom_triggers(account_id, is_active);

ALTER TABLE public.contract_custom_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cct_read" ON public.contract_custom_triggers
  FOR SELECT USING (can_access_account_data(auth.uid(), account_id));
CREATE POLICY "cct_insert" ON public.contract_custom_triggers
  FOR INSERT WITH CHECK (can_write_as_account(auth.uid(), account_id));
CREATE POLICY "cct_update" ON public.contract_custom_triggers
  FOR UPDATE USING (can_write_as_account(auth.uid(), account_id));
CREATE POLICY "cct_delete" ON public.contract_custom_triggers
  FOR DELETE USING (can_write_as_account(auth.uid(), account_id));

CREATE TRIGGER trg_cct_updated_at
BEFORE UPDATE ON public.contract_custom_triggers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
