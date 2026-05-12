
-- 1. live_contract_imports staging columns
ALTER TABLE public.live_contract_imports
  ADD COLUMN IF NOT EXISTS staging_status text NOT NULL DEFAULT 'draft'
    CHECK (staging_status IN ('draft','staging','published')),
  ADD COLUMN IF NOT EXISTS staged_fields jsonb,
  ADD COLUMN IF NOT EXISTS staging_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- 2. contract_invoice_schedules attachment metadata
ALTER TABLE public.contract_invoice_schedules
  ADD COLUMN IF NOT EXISTS attachment_source text
    CHECK (attachment_source IN ('generated','linked','ocr')),
  ADD COLUMN IF NOT EXISTS ocr_scanned_file_id uuid;

-- 3. ocr_usage_events
CREATE TABLE IF NOT EXISTS public.ocr_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid,
  source text NOT NULL DEFAULT 'invoice_upload',
  file_name text,
  page_count integer NOT NULL DEFAULT 1,
  unit_price_cents integer NOT NULL DEFAULT 75,
  total_cents integer NOT NULL,
  stripe_meter_event_id text,
  stripe_reported boolean NOT NULL DEFAULT false,
  contract_id uuid,
  invoice_id uuid,
  scanned_file_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ocr_usage_events_user_created
  ON public.ocr_usage_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ocr_usage_events_account_created
  ON public.ocr_usage_events (account_id, created_at DESC);

ALTER TABLE public.ocr_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ocr_usage_user_select" ON public.ocr_usage_events;
CREATE POLICY "ocr_usage_user_select"
  ON public.ocr_usage_events FOR SELECT
  USING (
    auth.uid() = user_id
    OR (account_id IS NOT NULL AND public.can_access_account_data(auth.uid(), account_id))
  );

DROP POLICY IF EXISTS "ocr_usage_user_insert" ON public.ocr_usage_events;
CREATE POLICY "ocr_usage_user_insert"
  ON public.ocr_usage_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. live_contract_watchers
CREATE TABLE IF NOT EXISTS public.live_contract_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.live_contract_imports(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lcw_contract ON public.live_contract_watchers (contract_id);
CREATE INDEX IF NOT EXISTS idx_lcw_user ON public.live_contract_watchers (user_id);

ALTER TABLE public.live_contract_watchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lcw_select" ON public.live_contract_watchers;
CREATE POLICY "lcw_select"
  ON public.live_contract_watchers FOR SELECT
  USING (public.can_access_account_data(auth.uid(), account_id) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "lcw_insert" ON public.live_contract_watchers;
CREATE POLICY "lcw_insert"
  ON public.live_contract_watchers FOR INSERT
  WITH CHECK (public.can_write_as_account(auth.uid(), account_id));

DROP POLICY IF EXISTS "lcw_delete" ON public.live_contract_watchers;
CREATE POLICY "lcw_delete"
  ON public.live_contract_watchers FOR DELETE
  USING (public.can_write_as_account(auth.uid(), account_id) OR auth.uid() = user_id);

-- 5. Extend user_alerts.alert_type to cover contract events
ALTER TABLE public.user_alerts DROP CONSTRAINT IF EXISTS user_alerts_alert_type_check;
ALTER TABLE public.user_alerts ADD CONSTRAINT user_alerts_alert_type_check
  CHECK (alert_type = ANY (ARRAY[
    'email_bounced','email_invalid','email_rejected','email_complained',
    'outreach_paused','outreach_resumed','sync_failed','payment_received','system',
    'contract_renewal','contract_opt_out','contract_expiration','contract_milestone','contract_invoice_due',
    'contract_staged','contract_published','contract_invoice_attached','ocr_scan_completed'
  ]));
