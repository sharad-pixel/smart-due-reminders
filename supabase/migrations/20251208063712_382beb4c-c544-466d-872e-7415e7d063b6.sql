-- Update RLS policies for remaining key tables to support team access

-- payments table
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own and team payments"
ON public.payments
FOR SELECT
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can insert own payments" ON public.payments;
CREATE POLICY "Users can insert payments for own or team account"
ON public.payments
FOR INSERT
WITH CHECK (user_id = get_effective_account_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own payments" ON public.payments;
CREATE POLICY "Users can update own and team payments"
ON public.payments
FOR UPDATE
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own payments" ON public.payments;
CREATE POLICY "Users can delete own and team payments"
ON public.payments
FOR DELETE
USING (can_access_account_data(auth.uid(), user_id));

-- ar_summary table
DROP POLICY IF EXISTS "Users can view own AR summaries" ON public.ar_summary;
CREATE POLICY "Users can view own and team AR summaries"
ON public.ar_summary
FOR SELECT
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can create own AR summaries" ON public.ar_summary;
CREATE POLICY "Users can create AR summaries for own or team account"
ON public.ar_summary
FOR INSERT
WITH CHECK (user_id = get_effective_account_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own AR summaries" ON public.ar_summary;
CREATE POLICY "Users can update own and team AR summaries"
ON public.ar_summary
FOR UPDATE
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own AR summaries" ON public.ar_summary;
CREATE POLICY "Users can delete own and team AR summaries"
ON public.ar_summary
FOR DELETE
USING (can_access_account_data(auth.uid(), user_id));

-- collection_outcomes table
DROP POLICY IF EXISTS "Users can view own outcomes" ON public.collection_outcomes;
CREATE POLICY "Users can view own and team outcomes"
ON public.collection_outcomes
FOR SELECT
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can create own outcomes" ON public.collection_outcomes;
CREATE POLICY "Users can create outcomes for own or team account"
ON public.collection_outcomes
FOR INSERT
WITH CHECK (user_id = get_effective_account_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own outcomes" ON public.collection_outcomes;
CREATE POLICY "Users can update own and team outcomes"
ON public.collection_outcomes
FOR UPDATE
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own outcomes" ON public.collection_outcomes;
CREATE POLICY "Users can delete own and team outcomes"
ON public.collection_outcomes
FOR DELETE
USING (can_access_account_data(auth.uid(), user_id));

-- inbound_emails table
DROP POLICY IF EXISTS "Users can view own inbound emails" ON public.inbound_emails;
CREATE POLICY "Users can view own and team inbound emails"
ON public.inbound_emails
FOR SELECT
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "System can create inbound emails" ON public.inbound_emails;
-- Keep system insert policy as is

DROP POLICY IF EXISTS "Users can update own inbound emails" ON public.inbound_emails;
CREATE POLICY "Users can update own and team inbound emails"
ON public.inbound_emails
FOR UPDATE
USING (can_access_account_data(auth.uid(), user_id));

-- cs_cases table
DROP POLICY IF EXISTS "Users can view own CS cases" ON public.cs_cases;
CREATE POLICY "Users can view own and team CS cases"
ON public.cs_cases
FOR SELECT
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can create own CS cases" ON public.cs_cases;
CREATE POLICY "Users can create CS cases for own or team account"
ON public.cs_cases
FOR INSERT
WITH CHECK (user_id = get_effective_account_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own CS cases" ON public.cs_cases;
CREATE POLICY "Users can update own and team CS cases"
ON public.cs_cases
FOR UPDATE
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own CS cases" ON public.cs_cases;
CREATE POLICY "Users can delete own and team CS cases"
ON public.cs_cases
FOR DELETE
USING (can_access_account_data(auth.uid(), user_id));

-- data_center_sources table  
DROP POLICY IF EXISTS "Users can view own sources" ON public.data_center_sources;
CREATE POLICY "Users can view own and team sources"
ON public.data_center_sources
FOR SELECT
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can create own sources" ON public.data_center_sources;
CREATE POLICY "Users can create sources for own or team account"
ON public.data_center_sources
FOR INSERT
WITH CHECK (user_id = get_effective_account_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own sources" ON public.data_center_sources;
CREATE POLICY "Users can update own and team sources"
ON public.data_center_sources
FOR UPDATE
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own sources" ON public.data_center_sources;
CREATE POLICY "Users can delete own and team sources"
ON public.data_center_sources
FOR DELETE
USING (can_access_account_data(auth.uid(), user_id));

-- data_center_uploads table
DROP POLICY IF EXISTS "Users can view own uploads" ON public.data_center_uploads;
CREATE POLICY "Users can view own and team uploads"
ON public.data_center_uploads
FOR SELECT
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can create own uploads" ON public.data_center_uploads;
CREATE POLICY "Users can create uploads for own or team account"
ON public.data_center_uploads
FOR INSERT
WITH CHECK (user_id = get_effective_account_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own uploads" ON public.data_center_uploads;
CREATE POLICY "Users can update own and team uploads"
ON public.data_center_uploads
FOR UPDATE
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own uploads" ON public.data_center_uploads;
CREATE POLICY "Users can delete own and team uploads"
ON public.data_center_uploads
FOR DELETE
USING (can_access_account_data(auth.uid(), user_id));

-- debtor_risk_history table
DROP POLICY IF EXISTS "Users can view own risk history" ON public.debtor_risk_history;
CREATE POLICY "Users can view own and team risk history"
ON public.debtor_risk_history
FOR SELECT
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can create own risk history" ON public.debtor_risk_history;
CREATE POLICY "Users can create risk history for own or team account"
ON public.debtor_risk_history
FOR INSERT
WITH CHECK (user_id = get_effective_account_id(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own risk history" ON public.debtor_risk_history;
CREATE POLICY "Users can delete own and team risk history"
ON public.debtor_risk_history
FOR DELETE
USING (can_access_account_data(auth.uid(), user_id));

-- crm_accounts table
DROP POLICY IF EXISTS "Users can view own CRM accounts" ON public.crm_accounts;
CREATE POLICY "Users can view own and team CRM accounts"
ON public.crm_accounts
FOR SELECT
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can create own CRM accounts" ON public.crm_accounts;
CREATE POLICY "Users can create CRM accounts for own or team account"
ON public.crm_accounts
FOR INSERT
WITH CHECK (user_id = get_effective_account_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own CRM accounts" ON public.crm_accounts;
CREATE POLICY "Users can update own and team CRM accounts"
ON public.crm_accounts
FOR UPDATE
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own CRM accounts" ON public.crm_accounts;
CREATE POLICY "Users can delete own and team CRM accounts"
ON public.crm_accounts
FOR DELETE
USING (can_access_account_data(auth.uid(), user_id));