-- Create audit trail table for AI creations
CREATE TABLE IF NOT EXISTS public.ai_creations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_prompt text NOT NULL,
  structured_json jsonb NOT NULL,
  created_debtor_id uuid REFERENCES public.debtors(id) ON DELETE SET NULL,
  created_invoice_ids jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_creations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own AI creations"
  ON public.ai_creations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AI creations"
  ON public.ai_creations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_creations_user_id ON public.ai_creations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_creations_created_at ON public.ai_creations(created_at DESC);