-- Add account locking columns for payment failure handling
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_account_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS account_locked_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS payment_failure_notice_sent_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS payment_failure_count integer DEFAULT 0;

-- Add index for efficient queries on locked accounts
CREATE INDEX IF NOT EXISTS idx_profiles_account_locked ON public.profiles(is_account_locked) WHERE is_account_locked = true;

-- Add index for payment failure notices
CREATE INDEX IF NOT EXISTS idx_profiles_payment_failure_notice ON public.profiles(payment_failure_notice_sent_at) WHERE payment_failure_notice_sent_at IS NOT NULL;