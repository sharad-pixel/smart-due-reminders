CREATE TABLE public.nicolas_prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  prompt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nicolas_prompt_templates TO authenticated;
GRANT ALL ON public.nicolas_prompt_templates TO service_role;

ALTER TABLE public.nicolas_prompt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own prompt templates"
  ON public.nicolas_prompt_templates FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own prompt templates"
  ON public.nicolas_prompt_templates FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own prompt templates"
  ON public.nicolas_prompt_templates FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own prompt templates"
  ON public.nicolas_prompt_templates FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_nicolas_prompt_templates_user ON public.nicolas_prompt_templates(user_id, updated_at DESC);

CREATE TRIGGER set_nicolas_prompt_templates_updated_at
  BEFORE UPDATE ON public.nicolas_prompt_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();