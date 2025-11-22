-- Create organizations table to formalize account concept
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Organizations policies
CREATE POLICY "Users can view their organization"
  ON public.organizations
  FOR SELECT
  USING (
    owner_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.account_users
      WHERE account_users.account_id = organizations.owner_user_id
        AND account_users.user_id = auth.uid()
        AND account_users.status = 'active'
    )
  );

CREATE POLICY "Owners can update their organization"
  ON public.organizations
  FOR UPDATE
  USING (owner_user_id = auth.uid());

CREATE POLICY "Users can create their organization"
  ON public.organizations
  FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create organizations for existing users who have account_users records
-- (users who are account owners)
INSERT INTO public.organizations (owner_user_id, name)
SELECT DISTINCT au.account_id, COALESCE(p.business_name, p.name, p.email, 'My Organization')
FROM public.account_users au
LEFT JOIN public.profiles p ON p.id = au.account_id
WHERE au.account_id NOT IN (SELECT owner_user_id FROM public.organizations)
ON CONFLICT DO NOTHING;