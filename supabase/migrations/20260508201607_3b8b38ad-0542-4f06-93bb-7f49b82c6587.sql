
-- CLM Entitlements
CREATE TABLE public.clm_entitlements (
  account_id UUID NOT NULL PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'disabled' CHECK (status IN ('active','disabled')),
  enabled_at TIMESTAMPTZ,
  enabled_by UUID,
  disabled_at TIMESTAMPTZ,
  notes TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clm_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all CLM entitlements"
ON public.clm_entitlements FOR ALL TO authenticated
USING (public.is_recouply_admin(auth.uid()))
WITH CHECK (public.is_recouply_admin(auth.uid()));

CREATE POLICY "Users view own account CLM entitlement"
ON public.clm_entitlements FOR SELECT TO authenticated
USING (public.can_access_account_data(auth.uid(), account_id));

CREATE TRIGGER trg_clm_entitlements_updated_at
BEFORE UPDATE ON public.clm_entitlements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: has the user's effective account got active CLM?
CREATE OR REPLACE FUNCTION public.has_clm_access(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clm_entitlements ce
    WHERE ce.status = 'active'
      AND (
        ce.account_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.account_users au
          WHERE au.user_id = _user_id
            AND au.account_id = ce.account_id
            AND au.status = 'active'
        )
      )
  );
$$;

-- Contracts table
CREATE TABLE public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  contract_type TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','pending_signature','active','expired','terminated','archived')),
  counterparty_name TEXT,
  counterparty_email TEXT,
  contract_value NUMERIC(14,2),
  currency TEXT DEFAULT 'USD',
  effective_date DATE,
  expiry_date DATE,
  renewal_date DATE,
  storage_path TEXT,
  ai_summary TEXT,
  ai_extracted_terms JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contracts_account_id ON public.contracts(account_id);
CREATE INDEX idx_contracts_status ON public.contracts(status);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members view contracts when CLM active"
ON public.contracts FOR SELECT TO authenticated
USING (
  public.can_access_account_data(auth.uid(), account_id)
  AND EXISTS (
    SELECT 1 FROM public.clm_entitlements ce
    WHERE ce.account_id = contracts.account_id AND ce.status = 'active'
  )
);

CREATE POLICY "Account writers create contracts when CLM active"
ON public.contracts FOR INSERT TO authenticated
WITH CHECK (
  public.can_write_as_account(auth.uid(), account_id)
  AND EXISTS (
    SELECT 1 FROM public.clm_entitlements ce
    WHERE ce.account_id = contracts.account_id AND ce.status = 'active'
  )
);

CREATE POLICY "Account writers update contracts when CLM active"
ON public.contracts FOR UPDATE TO authenticated
USING (
  public.can_write_as_account(auth.uid(), account_id)
  AND EXISTS (
    SELECT 1 FROM public.clm_entitlements ce
    WHERE ce.account_id = contracts.account_id AND ce.status = 'active'
  )
);

CREATE POLICY "Account writers delete contracts when CLM active"
ON public.contracts FOR DELETE TO authenticated
USING (
  public.can_write_as_account(auth.uid(), account_id)
  AND EXISTS (
    SELECT 1 FROM public.clm_entitlements ce
    WHERE ce.account_id = contracts.account_id AND ce.status = 'active'
  )
);

CREATE POLICY "Admins manage all contracts"
ON public.contracts FOR ALL TO authenticated
USING (public.is_recouply_admin(auth.uid()))
WITH CHECK (public.is_recouply_admin(auth.uid()));

CREATE TRIGGER trg_contracts_updated_at
BEFORE UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
