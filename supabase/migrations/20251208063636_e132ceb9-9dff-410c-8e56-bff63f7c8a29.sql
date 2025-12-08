-- Create function to get the effective account ID for a user
-- If user is part of a team (not owner), return the account owner's ID
-- Otherwise return their own ID
CREATE OR REPLACE FUNCTION public.get_effective_account_id(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  -- First check if user is a non-owner member of an account
  SELECT account_id INTO v_account_id
  FROM account_users
  WHERE user_id = p_user_id
    AND is_owner = false
    AND status = 'active'
  ORDER BY accepted_at DESC
  LIMIT 1;
  
  -- If they are part of a team, return the account owner's ID
  IF v_account_id IS NOT NULL THEN
    RETURN v_account_id;
  END IF;
  
  -- Otherwise return their own ID (they are either an owner or independent user)
  RETURN p_user_id;
END;
$$;

-- Create function to check if user can access account data
CREATE OR REPLACE FUNCTION public.can_access_account_data(p_user_id uuid, p_data_owner_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- User can access their own data
  IF p_user_id = p_data_owner_id THEN
    RETURN true;
  END IF;
  
  -- User can access data if they are a team member of that account
  RETURN EXISTS (
    SELECT 1 FROM account_users
    WHERE user_id = p_user_id
      AND account_id = p_data_owner_id
      AND status = 'active'
  );
END;
$$;

-- Update RLS policies for debtors table to allow team access
DROP POLICY IF EXISTS "Users can view own debtors" ON public.debtors;
CREATE POLICY "Users can view own and team debtors"
ON public.debtors
FOR SELECT
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can insert own debtors" ON public.debtors;
CREATE POLICY "Users can insert debtors to own or team account"
ON public.debtors
FOR INSERT
WITH CHECK (user_id = get_effective_account_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own debtors" ON public.debtors;
CREATE POLICY "Users can update own and team debtors"
ON public.debtors
FOR UPDATE
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own debtors" ON public.debtors;
CREATE POLICY "Users can delete own and team debtors"
ON public.debtors
FOR DELETE
USING (can_access_account_data(auth.uid(), user_id));

-- Update RLS policies for invoices table
DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;
CREATE POLICY "Users can view own and team invoices"
ON public.invoices
FOR SELECT
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can insert own invoices" ON public.invoices;
CREATE POLICY "Users can insert invoices to own or team account"
ON public.invoices
FOR INSERT
WITH CHECK (user_id = get_effective_account_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own invoices" ON public.invoices;
CREATE POLICY "Users can update own and team invoices"
ON public.invoices
FOR UPDATE
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own invoices" ON public.invoices;
CREATE POLICY "Users can delete own and team invoices"
ON public.invoices
FOR DELETE
USING (can_access_account_data(auth.uid(), user_id));

-- Update RLS policies for collection_tasks table
DROP POLICY IF EXISTS "Users can view own tasks" ON public.collection_tasks;
CREATE POLICY "Users can view own and team tasks"
ON public.collection_tasks
FOR SELECT
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can create own tasks" ON public.collection_tasks;
CREATE POLICY "Users can create tasks for own or team account"
ON public.collection_tasks
FOR INSERT
WITH CHECK (user_id = get_effective_account_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own tasks" ON public.collection_tasks;
CREATE POLICY "Users can update own and team tasks"
ON public.collection_tasks
FOR UPDATE
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own tasks" ON public.collection_tasks;
CREATE POLICY "Users can delete own and team tasks"
ON public.collection_tasks
FOR DELETE
USING (can_access_account_data(auth.uid(), user_id));

-- Update RLS policies for ai_drafts table
DROP POLICY IF EXISTS "Users can view own drafts" ON public.ai_drafts;
CREATE POLICY "Users can view own and team drafts"
ON public.ai_drafts
FOR SELECT
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can create own drafts" ON public.ai_drafts;
CREATE POLICY "Users can create drafts for own or team account"
ON public.ai_drafts
FOR INSERT
WITH CHECK (user_id = get_effective_account_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own drafts" ON public.ai_drafts;
CREATE POLICY "Users can update own and team drafts"
ON public.ai_drafts
FOR UPDATE
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own drafts" ON public.ai_drafts;
CREATE POLICY "Users can delete own and team drafts"
ON public.ai_drafts
FOR DELETE
USING (can_access_account_data(auth.uid(), user_id));

-- Update RLS policies for collection_activities table
DROP POLICY IF EXISTS "Users can view own activities" ON public.collection_activities;
CREATE POLICY "Users can view own and team activities"
ON public.collection_activities
FOR SELECT
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can create own activities" ON public.collection_activities;
CREATE POLICY "Users can create activities for own or team account"
ON public.collection_activities
FOR INSERT
WITH CHECK (user_id = get_effective_account_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own activities" ON public.collection_activities;
CREATE POLICY "Users can update own and team activities"
ON public.collection_activities
FOR UPDATE
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own activities" ON public.collection_activities;
CREATE POLICY "Users can delete own and team activities"
ON public.collection_activities
FOR DELETE
USING (can_access_account_data(auth.uid(), user_id));

-- Update RLS policies for branding_settings table
DROP POLICY IF EXISTS "Users can view own branding settings" ON public.branding_settings;
CREATE POLICY "Users can view own and team branding settings"
ON public.branding_settings
FOR SELECT
USING (can_access_account_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can insert own branding settings" ON public.branding_settings;
CREATE POLICY "Users can insert branding settings for own or team account"
ON public.branding_settings
FOR INSERT
WITH CHECK (user_id = get_effective_account_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own branding settings" ON public.branding_settings;
CREATE POLICY "Users can update own and team branding settings"
ON public.branding_settings
FOR UPDATE
USING (can_access_account_data(auth.uid(), user_id));

-- Update RLS policies for daily_digests table
DROP POLICY IF EXISTS "Users can view own digests" ON public.daily_digests;
CREATE POLICY "Users can view own and team digests"
ON public.daily_digests
FOR SELECT
USING (can_access_account_data(auth.uid(), user_id));