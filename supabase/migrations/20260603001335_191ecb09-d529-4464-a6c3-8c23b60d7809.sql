
CREATE TABLE public.live_contract_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  primary_import_id UUID NOT NULL REFERENCES public.live_contract_imports(id) ON DELETE CASCADE,
  linked_import_id UUID NOT NULL REFERENCES public.live_contract_imports(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'supplemental',
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT live_contract_links_no_self CHECK (primary_import_id <> linked_import_id),
  CONSTRAINT live_contract_links_type_check CHECK (link_type IN ('supplemental','expansion','amendment','renewal','sow','order_form','addendum')),
  CONSTRAINT live_contract_links_unique UNIQUE (primary_import_id, linked_import_id)
);
CREATE INDEX idx_lc_links_account ON public.live_contract_links(account_id);
CREATE INDEX idx_lc_links_primary ON public.live_contract_links(primary_import_id);
CREATE INDEX idx_lc_links_linked  ON public.live_contract_links(linked_import_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_contract_links TO authenticated;
GRANT ALL ON public.live_contract_links TO service_role;
ALTER TABLE public.live_contract_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lc_links_read" ON public.live_contract_links FOR SELECT TO authenticated USING (can_access_account_data(auth.uid(), account_id));
CREATE POLICY "lc_links_insert" ON public.live_contract_links FOR INSERT TO authenticated WITH CHECK (can_write_as_account(auth.uid(), account_id) AND auth.uid() = created_by);
CREATE POLICY "lc_links_update" ON public.live_contract_links FOR UPDATE TO authenticated USING (can_write_as_account(auth.uid(), account_id));
CREATE POLICY "lc_links_delete" ON public.live_contract_links FOR DELETE TO authenticated USING (can_write_as_account(auth.uid(), account_id));
CREATE TRIGGER trg_lc_links_updated_at BEFORE UPDATE ON public.live_contract_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.live_contract_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  import_id UUID NOT NULL REFERENCES public.live_contract_imports(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown',
  source TEXT NOT NULL DEFAULT 'auto',
  evidence TEXT,
  notes TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lc_checklist_status_check CHECK (status IN ('pass','warn','fail','unknown','na')),
  CONSTRAINT lc_checklist_source_check CHECK (source IN ('auto','manual')),
  CONSTRAINT lc_checklist_item_key_check CHECK (item_key IN ('fully_executed','terms_identified','performance_obligations_defined','term_dates_defined','risk_factors_assessed')),
  CONSTRAINT lc_checklist_unique UNIQUE (import_id, item_key)
);
CREATE INDEX idx_lc_checklist_account ON public.live_contract_checklist_items(account_id);
CREATE INDEX idx_lc_checklist_import ON public.live_contract_checklist_items(import_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_contract_checklist_items TO authenticated;
GRANT ALL ON public.live_contract_checklist_items TO service_role;
ALTER TABLE public.live_contract_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lc_checklist_read" ON public.live_contract_checklist_items FOR SELECT TO authenticated USING (can_access_account_data(auth.uid(), account_id));
CREATE POLICY "lc_checklist_insert" ON public.live_contract_checklist_items FOR INSERT TO authenticated WITH CHECK (can_write_as_account(auth.uid(), account_id));
CREATE POLICY "lc_checklist_update" ON public.live_contract_checklist_items FOR UPDATE TO authenticated USING (can_write_as_account(auth.uid(), account_id));
CREATE POLICY "lc_checklist_delete" ON public.live_contract_checklist_items FOR DELETE TO authenticated USING (can_write_as_account(auth.uid(), account_id));
CREATE TRIGGER trg_lc_checklist_updated_at BEFORE UPDATE ON public.live_contract_checklist_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
