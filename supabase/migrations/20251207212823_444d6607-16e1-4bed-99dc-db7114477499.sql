-- Add trial tracking field to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS trial_used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN public.profiles.trial_used_at IS 'Timestamp when user first started a trial. NULL means never used trial. Used to enforce one-trial-per-email.';

-- Create index for quick lookup
CREATE INDEX IF NOT EXISTS idx_profiles_trial_used ON public.profiles(trial_used_at) WHERE trial_used_at IS NOT NULL;