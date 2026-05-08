
-- Add owner-scoped SELECT policy for crm_connections (so RLS strictly enforces access; tokens stay server-side via service role)
CREATE POLICY "Users can view their own CRM connections"
ON public.crm_connections
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Restrict authenticated read on system_config to non-sensitive keys only
DROP POLICY IF EXISTS "Authenticated users can read system config" ON public.system_config;
CREATE POLICY "Authenticated users can read public system config"
ON public.system_config
FOR SELECT
TO authenticated
USING (key IN ('maintenance_mode'));

-- Add owner-scoped SELECT policy for campaign_outreach_emails so campaign owners can read their own emails via RLS
CREATE POLICY "Campaign owners can view their outreach emails"
ON public.campaign_outreach_emails
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.collection_campaigns cc
    WHERE cc.id = campaign_outreach_emails.campaign_id
      AND cc.user_id = auth.uid()
  )
);
