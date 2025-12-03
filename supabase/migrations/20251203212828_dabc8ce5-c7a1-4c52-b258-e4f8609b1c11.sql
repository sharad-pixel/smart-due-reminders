-- Add subscription-related columns to profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'invoice_limit') THEN
    ALTER TABLE public.profiles ADD COLUMN invoice_limit integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'overage_rate') THEN
    ALTER TABLE public.profiles ADD COLUMN overage_rate decimal(5,2) DEFAULT 1.50;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'billing_interval') THEN
    ALTER TABLE public.profiles ADD COLUMN billing_interval text DEFAULT 'month';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'subscription_status') THEN
    ALTER TABLE public.profiles ADD COLUMN subscription_status text DEFAULT 'inactive';
  END IF;
END $$;