CREATE TABLE IF NOT EXISTS public.clm_kurt_landing_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kurt_landing_user ON public.clm_kurt_landing_messages(user_id, created_at);

ALTER TABLE public.clm_kurt_landing_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own kurt landing chat"
  ON public.clm_kurt_landing_messages FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_recouply_admin(auth.uid()));

CREATE POLICY "Users insert own kurt landing chat"
  ON public.clm_kurt_landing_messages FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own kurt landing chat"
  ON public.clm_kurt_landing_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service writes kurt landing chat"
  ON public.clm_kurt_landing_messages
  TO service_role
  USING (true)
  WITH CHECK (true);