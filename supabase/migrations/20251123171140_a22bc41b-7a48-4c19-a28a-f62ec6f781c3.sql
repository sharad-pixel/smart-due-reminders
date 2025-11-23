-- Fix search path security for calculate_aging_bucket function
CREATE OR REPLACE FUNCTION calculate_aging_bucket(due_date DATE, payment_date DATE DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  days_past_due INTEGER;
BEGIN
  IF payment_date IS NOT NULL THEN
    RETURN 'paid';
  END IF;
  
  days_past_due := CURRENT_DATE - due_date;
  
  IF days_past_due < 0 THEN
    RETURN 'current';
  ELSIF days_past_due <= 30 THEN
    RETURN 'dpd_1_30';
  ELSIF days_past_due <= 60 THEN
    RETURN 'dpd_31_60';
  ELSIF days_past_due <= 90 THEN
    RETURN 'dpd_61_90';
  ELSIF days_past_due <= 120 THEN
    RETURN 'dpd_91_120';
  ELSE
    RETURN 'dpd_121_plus';
  END IF;
END;
$$;