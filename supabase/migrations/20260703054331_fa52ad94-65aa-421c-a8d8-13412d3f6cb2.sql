
DROP POLICY IF EXISTS "Users delete own account contract revenue items" ON public.contract_revenue_items;
DROP POLICY IF EXISTS "Users insert own account contract revenue items" ON public.contract_revenue_items;
DROP POLICY IF EXISTS "Users update own account contract revenue items" ON public.contract_revenue_items;
DROP POLICY IF EXISTS "Users view own account contract revenue items" ON public.contract_revenue_items;

CREATE POLICY "Users view own account contract revenue items" ON public.contract_revenue_items
  FOR SELECT USING (public.can_access_account_data(auth.uid(), account_id));
CREATE POLICY "Users insert own account contract revenue items" ON public.contract_revenue_items
  FOR INSERT WITH CHECK (public.can_write_as_account(auth.uid(), account_id));
CREATE POLICY "Users update own account contract revenue items" ON public.contract_revenue_items
  FOR UPDATE USING (public.can_write_as_account(auth.uid(), account_id))
  WITH CHECK (public.can_write_as_account(auth.uid(), account_id));
CREATE POLICY "Users delete own account contract revenue items" ON public.contract_revenue_items
  FOR DELETE USING (public.can_write_as_account(auth.uid(), account_id));

DROP POLICY IF EXISTS "Users delete own account library items" ON public.revenue_library_items;
DROP POLICY IF EXISTS "Users insert own account library items" ON public.revenue_library_items;
DROP POLICY IF EXISTS "Users update own account library items" ON public.revenue_library_items;
DROP POLICY IF EXISTS "Users view own account library items" ON public.revenue_library_items;

CREATE POLICY "Users view own account library items" ON public.revenue_library_items
  FOR SELECT USING (public.can_access_account_data(auth.uid(), account_id));
CREATE POLICY "Users insert own account library items" ON public.revenue_library_items
  FOR INSERT WITH CHECK (public.can_write_as_account(auth.uid(), account_id));
CREATE POLICY "Users update own account library items" ON public.revenue_library_items
  FOR UPDATE USING (public.can_write_as_account(auth.uid(), account_id))
  WITH CHECK (public.can_write_as_account(auth.uid(), account_id));
CREATE POLICY "Users delete own account library items" ON public.revenue_library_items
  FOR DELETE USING (public.can_write_as_account(auth.uid(), account_id));
