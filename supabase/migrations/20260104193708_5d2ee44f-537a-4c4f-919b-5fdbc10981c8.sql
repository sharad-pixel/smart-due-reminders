-- Add ai_risk_analysis column to debtors table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'debtors' AND column_name = 'ai_risk_analysis') THEN
    ALTER TABLE public.debtors ADD COLUMN ai_risk_analysis jsonb;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN public.debtors.ai_risk_analysis IS 'AI-generated risk analysis from GPT-4o-mini including risk assessment, key factors, and recommendations';