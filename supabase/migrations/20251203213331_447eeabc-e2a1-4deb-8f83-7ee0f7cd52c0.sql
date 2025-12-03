-- Add current_period_end column to profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'current_period_end') THEN
    ALTER TABLE public.profiles ADD COLUMN current_period_end timestamp with time zone;
  END IF;
END $$;