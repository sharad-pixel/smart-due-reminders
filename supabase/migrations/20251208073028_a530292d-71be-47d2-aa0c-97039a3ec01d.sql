-- Add seat billing end date column to track when deactivated users stop being billed
ALTER TABLE public.account_users 
ADD COLUMN IF NOT EXISTS seat_billing_ends_at TIMESTAMP WITH TIME ZONE;

-- Add comment explaining the column
COMMENT ON COLUMN public.account_users.seat_billing_ends_at IS 'When seat billing ends for deactivated users (end of current billing period)';

-- Create index for efficient querying of seats to remove
CREATE INDEX IF NOT EXISTS idx_account_users_seat_billing_ends 
ON public.account_users (seat_billing_ends_at) 
WHERE seat_billing_ends_at IS NOT NULL AND status = 'disabled';