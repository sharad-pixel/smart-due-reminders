ALTER POLICY "Users can update own workflows" ON public.collection_workflows
  WITH CHECK (auth.uid() = user_id);

ALTER POLICY "Organization admins can update documents" ON public.documents
  WITH CHECK (
    (EXISTS ( SELECT 1 FROM organizations
      WHERE organizations.id = documents.organization_id
        AND organizations.owner_user_id = auth.uid()))
    OR (EXISTS ( SELECT 1 FROM account_users
      WHERE account_users.account_id = documents.organization_id
        AND account_users.user_id = auth.uid()
        AND account_users.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role])
        AND account_users.status = 'active'))
  );