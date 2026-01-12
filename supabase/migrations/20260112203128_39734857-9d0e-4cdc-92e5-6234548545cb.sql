-- Allow users to dismiss/acknowledge their own QuickBooks sync issues
-- (needed for updating dismissed_errors from the UI)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quickbooks_sync_log'
      AND policyname = 'Users can update own QB sync logs'
  ) THEN
    CREATE POLICY "Users can update own QB sync logs"
    ON public.quickbooks_sync_log
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;