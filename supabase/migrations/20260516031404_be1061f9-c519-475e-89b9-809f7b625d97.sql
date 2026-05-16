ALTER TABLE public.asc606_assessments
  DROP CONSTRAINT IF EXISTS asc606_assessments_contract_id_fkey;

CREATE TABLE IF NOT EXISTS public.asc606_guidance_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  assessment_id uuid REFERENCES public.asc606_assessments(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  guidance text NOT NULL,
  guidance_jsonb jsonb,
  model_version text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asc606_guidance_contract
  ON public.asc606_guidance_messages(contract_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_asc606_guidance_assessment
  ON public.asc606_guidance_messages(assessment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_asc606_guidance_account
  ON public.asc606_guidance_messages(account_id, created_at DESC);

ALTER TABLE public.asc606_guidance_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members view ASC 606 guidance" ON public.asc606_guidance_messages;
CREATE POLICY "Account members view ASC 606 guidance"
  ON public.asc606_guidance_messages
  FOR SELECT
  TO authenticated
  USING (public.can_access_account_data(auth.uid(), account_id));