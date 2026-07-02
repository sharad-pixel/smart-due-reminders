
ALTER TABLE public.debtors ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.debtors ADD COLUMN IF NOT EXISTS stripe_customer_linked_at timestamptz;

-- Prevent duplicate linking: one debtor per stripe customer within an account
CREATE UNIQUE INDEX IF NOT EXISTS uq_debtors_user_stripe_customer
  ON public.debtors (user_id, stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_debtors_stripe_customer_id
  ON public.debtors (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
