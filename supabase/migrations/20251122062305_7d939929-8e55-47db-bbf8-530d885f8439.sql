-- Add admin flag to profiles for Recouply.ai staff
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create index for faster admin queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin) WHERE is_admin = true;

-- Create function to check if user is Recouply.ai admin
CREATE OR REPLACE FUNCTION public.is_recouply_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = _user_id),
    false
  )
$$;

-- Update admin_user_actions to include action_type for better filtering
ALTER TABLE public.admin_user_actions 
ADD COLUMN IF NOT EXISTS action_type TEXT;

CREATE INDEX IF NOT EXISTS idx_admin_user_actions_type 
ON public.admin_user_actions(action_type);

CREATE INDEX IF NOT EXISTS idx_admin_user_actions_target 
ON public.admin_user_actions(target_user_id);

-- Add RLS policy for admins to view all profiles
CREATE POLICY "Recouply admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_recouply_admin(auth.uid()));

-- Add RLS policy for admins to update any profile
CREATE POLICY "Recouply admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (is_recouply_admin(auth.uid()));

-- Add RLS policies for admin_user_actions
CREATE POLICY "Recouply admins can insert actions"
ON public.admin_user_actions
FOR INSERT
TO authenticated
WITH CHECK (is_recouply_admin(auth.uid()));

CREATE POLICY "Recouply admins can view all actions"
ON public.admin_user_actions
FOR SELECT
TO authenticated
USING (is_recouply_admin(auth.uid()));

-- Add RLS policies for user_feature_overrides
CREATE POLICY "Recouply admins can manage feature overrides"
ON public.user_feature_overrides
FOR ALL
TO authenticated
USING (is_recouply_admin(auth.uid()))
WITH CHECK (is_recouply_admin(auth.uid()));