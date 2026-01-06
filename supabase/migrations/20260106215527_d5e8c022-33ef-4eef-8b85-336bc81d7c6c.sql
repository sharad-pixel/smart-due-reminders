-- Add dismissed_at column to track when an alert was dismissed
ALTER TABLE public.user_alerts ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMP WITH TIME ZONE;

-- Create function to auto-delete dismissed alerts older than 30 days
CREATE OR REPLACE FUNCTION public.cleanup_dismissed_user_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_alerts
  WHERE is_dismissed = true
    AND dismissed_at IS NOT NULL
    AND dismissed_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Update trigger to set dismissed_at when is_dismissed changes to true
CREATE OR REPLACE FUNCTION public.set_dismissed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_dismissed = true AND (OLD.is_dismissed = false OR OLD.dismissed_at IS NULL) THEN
    NEW.dismissed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_alert_dismissed_at ON public.user_alerts;
CREATE TRIGGER set_user_alert_dismissed_at
  BEFORE UPDATE ON public.user_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_dismissed_at();