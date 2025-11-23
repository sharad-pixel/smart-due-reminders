-- Add payment score fields to debtors table
ALTER TABLE debtors 
ADD COLUMN IF NOT EXISTS payment_score INTEGER DEFAULT 50 CHECK (payment_score >= 0 AND payment_score <= 100),
ADD COLUMN IF NOT EXISTS payment_risk_tier TEXT DEFAULT 'medium' CHECK (payment_risk_tier IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS avg_days_to_pay NUMERIC,
ADD COLUMN IF NOT EXISTS max_days_past_due INTEGER,
ADD COLUMN IF NOT EXISTS disputed_invoices_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS in_payment_plan_invoices_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS open_invoices_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS written_off_invoices_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_score_last_calculated TIMESTAMP WITH TIME ZONE;

-- Add index for performance on payment score queries
CREATE INDEX IF NOT EXISTS idx_debtors_payment_score ON debtors(payment_score DESC);
CREATE INDEX IF NOT EXISTS idx_debtors_payment_risk_tier ON debtors(payment_risk_tier);

-- Add aging mix percentages
ALTER TABLE debtors
ADD COLUMN IF NOT EXISTS aging_mix_current_pct NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS aging_mix_1_30_pct NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS aging_mix_31_60_pct NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS aging_mix_61_90_pct NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS aging_mix_91_120_pct NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS aging_mix_121_plus_pct NUMERIC DEFAULT 0;

-- Add paid_date to invoices if it doesn't exist
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS paid_date DATE;

-- Create a function to calculate aging bucket
CREATE OR REPLACE FUNCTION calculate_aging_bucket(due_date DATE, payment_date DATE DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  days_past_due INTEGER;
BEGIN
  IF payment_date IS NOT NULL THEN
    -- Invoice is paid, no aging bucket
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
$$ LANGUAGE plpgsql IMMUTABLE;