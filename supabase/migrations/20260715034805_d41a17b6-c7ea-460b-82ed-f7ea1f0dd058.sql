ALTER TABLE public.drive_connections
  ADD COLUMN IF NOT EXISTS needs_reconnect BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reconnect_reason TEXT,
  ADD COLUMN IF NOT EXISTS reconnect_flagged_at TIMESTAMPTZ;