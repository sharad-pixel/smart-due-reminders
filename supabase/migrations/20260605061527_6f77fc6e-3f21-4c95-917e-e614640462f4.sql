DROP POLICY IF EXISTS "lc_delete_live_contract_audit_log" ON public.live_contract_audit_log;
DROP POLICY IF EXISTS "lc_update_live_contract_audit_log" ON public.live_contract_audit_log;
REVOKE DELETE, UPDATE ON public.live_contract_audit_log FROM authenticated, anon;