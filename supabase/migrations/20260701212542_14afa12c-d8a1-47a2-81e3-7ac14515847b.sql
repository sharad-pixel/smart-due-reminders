-- Parent assessments
CREATE TABLE public.ai_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID,
  scope TEXT NOT NULL CHECK (scope IN ('asc606','contract_intelligence','collectability','revenue_risk','other')),
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  findings JSONB NOT NULL DEFAULT '{}'::jsonb,
  model TEXT,
  pinned BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ai_assessments_subject_idx ON public.ai_assessments (scope, subject_type, subject_id);
CREATE INDEX ai_assessments_user_idx ON public.ai_assessments (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_assessments TO authenticated;
GRANT ALL ON public.ai_assessments TO service_role;

ALTER TABLE public.ai_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own assessments"
  ON public.ai_assessments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Supplemental prompts, tracked separately
CREATE TABLE public.ai_assessment_prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.ai_assessments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  response TEXT,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('pending','complete','error')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ai_assessment_prompts_parent_idx ON public.ai_assessment_prompts (assessment_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_assessment_prompts TO authenticated;
GRANT ALL ON public.ai_assessment_prompts TO service_role;

ALTER TABLE public.ai_assessment_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own supplemental prompts"
  ON public.ai_assessment_prompts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at trigger (reuse if exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_ai_assessments_updated_at
  BEFORE UPDATE ON public.ai_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_assessment_prompts_updated_at
  BEFORE UPDATE ON public.ai_assessment_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();