
-- 1) Flag on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_support_user boolean NOT NULL DEFAULT false;

-- 2) support_users: allowlist of Recouply support staff emails
CREATE TABLE IF NOT EXISTS public.support_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  is_active boolean NOT NULL DEFAULT true,
  auth_user_id uuid,                           -- linked profiles.id once provisioned
  created_by uuid,                             -- admin who added them
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_support_users_email_lower
  ON public.support_users (lower(email));

ALTER TABLE public.support_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read support users"
  ON public.support_users FOR SELECT
  USING (public.is_recouply_admin(auth.uid()));

CREATE POLICY "Admins can insert support users"
  ON public.support_users FOR INSERT
  WITH CHECK (public.is_recouply_admin(auth.uid()));

CREATE POLICY "Admins can update support users"
  ON public.support_users FOR UPDATE
  USING (public.is_recouply_admin(auth.uid()));

CREATE POLICY "Admins can delete support users"
  ON public.support_users FOR DELETE
  USING (public.is_recouply_admin(auth.uid()));

CREATE TRIGGER trg_support_users_updated_at
  BEFORE UPDATE ON public.support_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) support_login_codes: short-lived 6-digit codes (step 1 of 2-step login)
CREATE TABLE IF NOT EXISTS public.support_login_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,                     -- sha256(code)
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_login_codes_email_lower_created
  ON public.support_login_codes (lower(email), created_at DESC);

ALTER TABLE public.support_login_codes ENABLE ROW LEVEL SECURITY;

-- No client access; all reads/writes happen via edge functions with service role.
CREATE POLICY "Admins can read login codes"
  ON public.support_login_codes FOR SELECT
  USING (public.is_recouply_admin(auth.uid()));
