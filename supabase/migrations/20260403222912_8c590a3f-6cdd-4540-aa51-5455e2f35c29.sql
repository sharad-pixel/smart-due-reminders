
DROP POLICY IF EXISTS "Authenticated users can insert debtors" ON public.debtors;
CREATE POLICY "Authenticated users can insert debtors"
  ON public.debtors FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    OR user_id = get_effective_account_id(auth.uid())
  );
