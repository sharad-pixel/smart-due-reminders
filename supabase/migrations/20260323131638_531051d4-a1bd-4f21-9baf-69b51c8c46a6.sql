
CREATE TABLE public.scheduled_deletions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text NOT NULL,
  user_name text,
  scheduled_by uuid NOT NULL,
  reason text DEFAULT 'Account deletion requested by administrator',
  notice_sent_at timestamptz NOT NULL DEFAULT now(),
  deletion_scheduled_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancellation_reason text,
  legal_notice_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage scheduled deletions"
  ON public.scheduled_deletions
  FOR ALL
  TO authenticated
  USING (public.is_recouply_admin(auth.uid()));

CREATE INDEX idx_scheduled_deletions_status ON public.scheduled_deletions(status);
CREATE INDEX idx_scheduled_deletions_user_id ON public.scheduled_deletions(user_id);
CREATE INDEX idx_scheduled_deletions_scheduled_at ON public.scheduled_deletions(deletion_scheduled_at) WHERE status = 'pending';
