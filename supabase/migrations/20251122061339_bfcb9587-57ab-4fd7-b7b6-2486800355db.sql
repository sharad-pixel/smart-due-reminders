-- Create app_role enum for role-based access
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- Create account_users table for team members
CREATE TABLE public.account_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member',
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disabled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, user_id)
);

-- Create user_feature_overrides table for admin overrides
CREATE TABLE public.user_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  value BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by_admin_id UUID REFERENCES auth.users(id),
  UNIQUE(user_id, feature_key)
);

-- Create admin_user_actions table for audit logging
CREATE TABLE public.admin_user_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_users
    WHERE user_id = _user_id
      AND role = _role
      AND status = 'active'
  )
$$;

-- Create function to check if user is account owner or admin
CREATE OR REPLACE FUNCTION public.is_account_manager(_user_id UUID, _account_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_users
    WHERE user_id = _user_id
      AND account_id = _account_id
      AND role IN ('owner', 'admin')
      AND status = 'active'
  )
$$;

-- Enable RLS on account_users
ALTER TABLE public.account_users ENABLE ROW LEVEL SECURITY;

-- RLS policies for account_users
CREATE POLICY "Users can view team members of their accounts"
  ON public.account_users
  FOR SELECT
  TO authenticated
  USING (
    account_id = auth.uid() OR
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.account_users au
      WHERE au.account_id = account_users.account_id
        AND au.user_id = auth.uid()
        AND au.status = 'active'
    )
  );

CREATE POLICY "Account owners and admins can manage team"
  ON public.account_users
  FOR ALL
  TO authenticated
  USING (public.is_account_manager(auth.uid(), account_id))
  WITH CHECK (public.is_account_manager(auth.uid(), account_id));

-- Enable RLS on user_feature_overrides
ALTER TABLE public.user_feature_overrides ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_feature_overrides (admin-only access via backend)
CREATE POLICY "Users can view their own feature overrides"
  ON public.user_feature_overrides
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Enable RLS on admin_user_actions
ALTER TABLE public.admin_user_actions ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin_user_actions (admin-only access)
CREATE POLICY "Admins can view all actions"
  ON public.admin_user_actions
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indices for performance
CREATE INDEX idx_account_users_account_id ON public.account_users(account_id);
CREATE INDEX idx_account_users_user_id ON public.account_users(user_id);
CREATE INDEX idx_account_users_status ON public.account_users(status);
CREATE INDEX idx_user_feature_overrides_user_id ON public.user_feature_overrides(user_id);
CREATE INDEX idx_admin_user_actions_admin_id ON public.admin_user_actions(admin_id);
CREATE INDEX idx_admin_user_actions_target_user_id ON public.admin_user_actions(target_user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_account_users_updated_at
  BEFORE UPDATE ON public.account_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_feature_overrides_updated_at
  BEFORE UPDATE ON public.user_feature_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Initialize account owners (existing users become owners of their own accounts)
INSERT INTO public.account_users (account_id, user_id, role, status, accepted_at)
SELECT id, id, 'owner', 'active', NOW()
FROM auth.users
ON CONFLICT (account_id, user_id) DO NOTHING;