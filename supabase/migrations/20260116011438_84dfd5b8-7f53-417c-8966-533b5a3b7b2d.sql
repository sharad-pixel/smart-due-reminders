-- Add admin_override column to profiles to prevent automatic sync from overwriting
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS admin_override boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS admin_override_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS admin_override_by uuid,
ADD COLUMN IF NOT EXISTS admin_override_notes text;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.admin_override IS 'When true, sync-subscription will not overwrite plan_type, subscription_status, trial_ends_at, current_period_end, or invoice_limit';
COMMENT ON COLUMN public.profiles.admin_override_at IS 'Timestamp when admin override was enabled';
COMMENT ON COLUMN public.profiles.admin_override_by IS 'Admin user ID who enabled the override';
COMMENT ON COLUMN public.profiles.admin_override_notes IS 'Notes about why the override was applied';