-- Add column to store cached intelligence report with timestamp
ALTER TABLE public.debtors 
ADD COLUMN IF NOT EXISTS intelligence_report JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS intelligence_report_generated_at TIMESTAMPTZ DEFAULT NULL;