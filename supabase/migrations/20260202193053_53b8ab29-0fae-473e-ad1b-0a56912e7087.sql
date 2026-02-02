-- Add D&B PAYDEX-style credit rating fields to debtors table
ALTER TABLE public.debtors 
ADD COLUMN IF NOT EXISTS paydex_score integer,
ADD COLUMN IF NOT EXISTS paydex_rating text,
ADD COLUMN IF NOT EXISTS payment_trend text,
ADD COLUMN IF NOT EXISTS credit_limit_recommendation numeric,
ADD COLUMN IF NOT EXISTS payment_experience_summary jsonb;

-- Add comment explaining the PAYDEX scoring
COMMENT ON COLUMN public.debtors.paydex_score IS 'D&B PAYDEX-style score (1-100). 80+=Prompt, 50-79=Slow, <50=Very Slow';
COMMENT ON COLUMN public.debtors.paydex_rating IS 'PAYDEX rating: Prompt, Generally Prompt, Slow Pay, Very Slow Pay, Delinquent, Severely Delinquent';
COMMENT ON COLUMN public.debtors.payment_trend IS 'Payment trend: Improving, Slightly Improving, Stable, Slightly Declining, Declining';
COMMENT ON COLUMN public.debtors.credit_limit_recommendation IS 'Recommended credit limit based on payment behavior';
COMMENT ON COLUMN public.debtors.payment_experience_summary IS 'Summary of payment experiences including prompt/slow/delinquent percentages';

-- Add index for PAYDEX score queries
CREATE INDEX IF NOT EXISTS idx_debtors_paydex_score ON public.debtors(paydex_score) WHERE paydex_score IS NOT NULL;