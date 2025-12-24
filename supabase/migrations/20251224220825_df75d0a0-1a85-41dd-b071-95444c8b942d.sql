-- Ensure Row Level Security is enabled
ALTER TABLE public.draft_templates ENABLE ROW LEVEL SECURITY;

-- Migrate existing draft templates to the effective (account-level) owner so templates apply to all child accounts
UPDATE public.draft_templates
SET user_id = public.get_effective_account_id(user_id)
WHERE user_id IS NOT NULL
  AND user_id <> public.get_effective_account_id(user_id);

-- Replace per-user-only policies with account-level access (owner + team members)
DROP POLICY IF EXISTS "Users can view own draft templates" ON public.draft_templates;
DROP POLICY IF EXISTS "Users can create own draft templates" ON public.draft_templates;
DROP POLICY IF EXISTS "Users can update own draft templates" ON public.draft_templates;
DROP POLICY IF EXISTS "Users can delete own draft templates" ON public.draft_templates;

CREATE POLICY "Users can view own and team draft templates"
ON public.draft_templates
FOR SELECT
USING (public.can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Users can create draft templates for own or team account"
ON public.draft_templates
FOR INSERT
WITH CHECK (user_id = public.get_effective_account_id(auth.uid()));

CREATE POLICY "Users can update own and team draft templates"
ON public.draft_templates
FOR UPDATE
USING (public.can_access_account_data(auth.uid(), user_id))
WITH CHECK (public.can_access_account_data(auth.uid(), user_id));

CREATE POLICY "Users can delete own and team draft templates"
ON public.draft_templates
FOR DELETE
USING (public.can_access_account_data(auth.uid(), user_id));