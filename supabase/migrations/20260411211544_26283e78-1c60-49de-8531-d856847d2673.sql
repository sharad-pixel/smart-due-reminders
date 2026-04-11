
CREATE TABLE public.onboarding_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  current_step INTEGER NOT NULL DEFAULT 1,
  business_profile_completed BOOLEAN NOT NULL DEFAULT false,
  documents_uploaded BOOLEAN NOT NULL DEFAULT false,
  branding_completed BOOLEAN NOT NULL DEFAULT false,
  training_viewed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own onboarding progress"
  ON public.onboarding_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own onboarding progress"
  ON public.onboarding_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own onboarding progress"
  ON public.onboarding_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_onboarding_progress_user_id ON public.onboarding_progress(user_id);

CREATE TRIGGER update_onboarding_progress_updated_at
  BEFORE UPDATE ON public.onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create onboarding record for new profiles
CREATE OR REPLACE FUNCTION public.create_onboarding_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO onboarding_progress (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_create_onboarding
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_onboarding_for_new_user();
