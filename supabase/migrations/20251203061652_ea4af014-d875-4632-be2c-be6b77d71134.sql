-- Create team_members table for task assignment
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own team members"
ON public.team_members FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own team members"
ON public.team_members FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own team members"
ON public.team_members FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own team members"
ON public.team_members FOR DELETE
USING (auth.uid() = user_id);

-- Update trigger for updated_at
CREATE TRIGGER update_team_members_updated_at
BEFORE UPDATE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();