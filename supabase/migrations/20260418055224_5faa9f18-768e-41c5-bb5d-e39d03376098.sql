
-- ============================================================================
-- Fix: Restrict write access to owner/admin/member roles (exclude viewer)
-- Adds can_write_as_account() helper and rewrites INSERT policies on sensitive
-- tables so viewers (and any future non-write roles) cannot create records
-- attributed to the account owner.
-- ============================================================================

-- Helper: returns true if the calling user is allowed to write as the given account.
-- Allowed when the user IS the account owner, OR is an active team member with
-- a write-capable role (owner/admin/member). Viewers are excluded.
CREATE OR REPLACE FUNCTION public.can_write_as_account(p_user_id uuid, p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Direct owner: writing to their own account
    p_user_id = p_account_id
    OR
    -- Active team member with write-capable role
    EXISTS (
      SELECT 1
      FROM public.account_users
      WHERE user_id = p_user_id
        AND account_id = p_account_id
        AND status = 'active'
        AND role IN ('owner', 'admin', 'member')
    );
$$;

-- ============================================================================
-- Replace all INSERT policies that previously allowed viewers to write
-- ============================================================================

-- ai_drafts
DROP POLICY IF EXISTS "Users can create drafts for own or team account" ON public.ai_drafts;
CREATE POLICY "Users can create drafts for own or team account"
ON public.ai_drafts FOR INSERT TO authenticated
WITH CHECK (public.can_write_as_account(auth.uid(), user_id));

-- ar_summary
DROP POLICY IF EXISTS "Users can create AR summaries for own or team account" ON public.ar_summary;
CREATE POLICY "Users can create AR summaries for own or team account"
ON public.ar_summary FOR INSERT TO authenticated
WITH CHECK (public.can_write_as_account(auth.uid(), user_id));

-- branding_settings
DROP POLICY IF EXISTS "Users can insert branding settings for own or team account" ON public.branding_settings;
CREATE POLICY "Users can insert branding settings for own or team account"
ON public.branding_settings FOR INSERT TO authenticated
WITH CHECK (public.can_write_as_account(auth.uid(), user_id));

-- collection_activities
DROP POLICY IF EXISTS "Users can create activities for own or team account" ON public.collection_activities;
CREATE POLICY "Users can create activities for own or team account"
ON public.collection_activities FOR INSERT TO authenticated
WITH CHECK (public.can_write_as_account(auth.uid(), user_id));

-- collection_campaigns
DROP POLICY IF EXISTS "Users can create campaigns for own or team account" ON public.collection_campaigns;
CREATE POLICY "Users can create campaigns for own or team account"
ON public.collection_campaigns FOR INSERT TO authenticated
WITH CHECK (public.can_write_as_account(auth.uid(), user_id));

-- collection_outcomes
DROP POLICY IF EXISTS "Users can create outcomes for own or team account" ON public.collection_outcomes;
CREATE POLICY "Users can create outcomes for own or team account"
ON public.collection_outcomes FOR INSERT TO authenticated
WITH CHECK (public.can_write_as_account(auth.uid(), user_id));

-- collection_tasks
DROP POLICY IF EXISTS "Users can create tasks for own or team account" ON public.collection_tasks;
CREATE POLICY "Users can create tasks for own or team account"
ON public.collection_tasks FOR INSERT TO authenticated
WITH CHECK (public.can_write_as_account(auth.uid(), user_id));

-- crm_accounts
DROP POLICY IF EXISTS "Users can create CRM accounts for own or team account" ON public.crm_accounts;
CREATE POLICY "Users can create CRM accounts for own or team account"
ON public.crm_accounts FOR INSERT TO authenticated
WITH CHECK (public.can_write_as_account(auth.uid(), user_id));

-- cs_cases
DROP POLICY IF EXISTS "Users can create CS cases for own or team account" ON public.cs_cases;
CREATE POLICY "Users can create CS cases for own or team account"
ON public.cs_cases FOR INSERT TO authenticated
WITH CHECK (public.can_write_as_account(auth.uid(), user_id));

-- data_center_sources
DROP POLICY IF EXISTS "Users can create sources for own or team account" ON public.data_center_sources;
CREATE POLICY "Users can create sources for own or team account"
ON public.data_center_sources FOR INSERT TO authenticated
WITH CHECK (public.can_write_as_account(auth.uid(), user_id));

-- data_center_uploads
DROP POLICY IF EXISTS "Users can create uploads for own or team account" ON public.data_center_uploads;
CREATE POLICY "Users can create uploads for own or team account"
ON public.data_center_uploads FOR INSERT TO authenticated
WITH CHECK (public.can_write_as_account(auth.uid(), user_id));

-- debtor_contacts
DROP POLICY IF EXISTS "Users can create contacts for own or team account" ON public.debtor_contacts;
CREATE POLICY "Users can create contacts for own or team account"
ON public.debtor_contacts FOR INSERT TO authenticated
WITH CHECK (public.can_write_as_account(auth.uid(), user_id));

-- debtor_risk_history
DROP POLICY IF EXISTS "Users can create risk history for own or team account" ON public.debtor_risk_history;
CREATE POLICY "Users can create risk history for own or team account"
ON public.debtor_risk_history FOR INSERT TO authenticated
WITH CHECK (public.can_write_as_account(auth.uid(), user_id));

-- debtors
DROP POLICY IF EXISTS "Authenticated users can insert debtors" ON public.debtors;
CREATE POLICY "Authenticated users can insert debtors"
ON public.debtors FOR INSERT TO authenticated
WITH CHECK (public.can_write_as_account(auth.uid(), user_id));

-- draft_templates
DROP POLICY IF EXISTS "Users can create draft templates for own or team account" ON public.draft_templates;
CREATE POLICY "Users can create draft templates for own or team account"
ON public.draft_templates FOR INSERT TO authenticated
WITH CHECK (public.can_write_as_account(auth.uid(), user_id));

-- invoice_transactions
DROP POLICY IF EXISTS "Users can create transactions for own or team account" ON public.invoice_transactions;
CREATE POLICY "Users can create transactions for own or team account"
ON public.invoice_transactions FOR INSERT TO authenticated
WITH CHECK (public.can_write_as_account(auth.uid(), user_id));

-- invoices
DROP POLICY IF EXISTS "Users can insert invoices to own or team account" ON public.invoices;
CREATE POLICY "Users can insert invoices to own or team account"
ON public.invoices FOR INSERT TO authenticated
WITH CHECK (public.can_write_as_account(auth.uid(), user_id));

-- payments
DROP POLICY IF EXISTS "Users can insert payments for own or team account" ON public.payments;
CREATE POLICY "Users can insert payments for own or team account"
ON public.payments FOR INSERT TO authenticated
WITH CHECK (public.can_write_as_account(auth.uid(), user_id));
