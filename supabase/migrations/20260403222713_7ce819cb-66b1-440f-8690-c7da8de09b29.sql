
-- Fix UPDATE policy to include WITH CHECK clause
DROP POLICY IF EXISTS "Users can update their own pending imports" ON public.pending_sheet_imports;
CREATE POLICY "Users can update their own pending imports"
  ON public.pending_sheet_imports FOR UPDATE
  USING ((user_id = auth.uid()) OR (user_id = get_effective_account_id(auth.uid())))
  WITH CHECK ((user_id = auth.uid()) OR (user_id = get_effective_account_id(auth.uid())));
