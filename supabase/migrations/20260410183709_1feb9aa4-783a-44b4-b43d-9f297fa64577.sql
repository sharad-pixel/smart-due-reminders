-- Fix 1: Drop the overly permissive payment_plans SELECT policy
DROP POLICY IF EXISTS "Public can view payment plans by token" ON public.payment_plans;

-- Fix 2: Set search_path on set_dismissed_at function
CREATE OR REPLACE FUNCTION public.set_dismissed_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  IF NEW.is_dismissed = true AND (OLD.is_dismissed = false OR OLD.dismissed_at IS NULL) THEN
    NEW.dismissed_at = NOW();
  END IF;
  RETURN NEW;
END;
$function$;