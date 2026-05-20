
CREATE TABLE public.revenue_library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  description TEXT,
  revenue_type TEXT NOT NULL DEFAULT 'one_time',
  performance_obligation TEXT,
  recognition_method TEXT NOT NULL DEFAULT 'point_in_time',
  standalone_selling_price NUMERIC(18,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  default_term_months INTEGER,
  billing_frequency TEXT,
  tax_category TEXT,
  gl_account_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rli_revenue_type_chk CHECK (revenue_type IN ('one_time','subscription','usage','milestone','professional_services','other')),
  CONSTRAINT rli_recognition_chk CHECK (recognition_method IN ('point_in_time','over_time_straight_line','over_time_usage','milestone','percentage_completion'))
);

CREATE INDEX idx_rli_account ON public.revenue_library_items(account_id);
CREATE INDEX idx_rli_active ON public.revenue_library_items(account_id, is_active);
CREATE UNIQUE INDEX idx_rli_account_sku ON public.revenue_library_items(account_id, sku) WHERE sku IS NOT NULL;

ALTER TABLE public.revenue_library_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own account library items"
  ON public.revenue_library_items FOR SELECT
  USING (account_id IN (SELECT account_id FROM public.account_users WHERE user_id = auth.uid()));

CREATE POLICY "Users insert own account library items"
  ON public.revenue_library_items FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM public.account_users WHERE user_id = auth.uid()));

CREATE POLICY "Users update own account library items"
  ON public.revenue_library_items FOR UPDATE
  USING (account_id IN (SELECT account_id FROM public.account_users WHERE user_id = auth.uid()));

CREATE POLICY "Users delete own account library items"
  ON public.revenue_library_items FOR DELETE
  USING (account_id IN (SELECT account_id FROM public.account_users WHERE user_id = auth.uid()));

CREATE TRIGGER trg_rli_updated_at
  BEFORE UPDATE ON public.revenue_library_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.contract_revenue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  import_id UUID NOT NULL REFERENCES public.live_contract_imports(id) ON DELETE CASCADE,
  library_item_id UUID NOT NULL REFERENCES public.revenue_library_items(id) ON DELETE RESTRICT,
  quantity NUMERIC(18,4) NOT NULL DEFAULT 1,
  allocated_price NUMERIC(18,2),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cri_import ON public.contract_revenue_items(import_id);
CREATE INDEX idx_cri_library ON public.contract_revenue_items(library_item_id);
CREATE INDEX idx_cri_account ON public.contract_revenue_items(account_id);

ALTER TABLE public.contract_revenue_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own account contract revenue items"
  ON public.contract_revenue_items FOR SELECT
  USING (account_id IN (SELECT account_id FROM public.account_users WHERE user_id = auth.uid()));

CREATE POLICY "Users insert own account contract revenue items"
  ON public.contract_revenue_items FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM public.account_users WHERE user_id = auth.uid()));

CREATE POLICY "Users update own account contract revenue items"
  ON public.contract_revenue_items FOR UPDATE
  USING (account_id IN (SELECT account_id FROM public.account_users WHERE user_id = auth.uid()));

CREATE POLICY "Users delete own account contract revenue items"
  ON public.contract_revenue_items FOR DELETE
  USING (account_id IN (SELECT account_id FROM public.account_users WHERE user_id = auth.uid()));

CREATE TRIGGER trg_cri_updated_at
  BEFORE UPDATE ON public.contract_revenue_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
