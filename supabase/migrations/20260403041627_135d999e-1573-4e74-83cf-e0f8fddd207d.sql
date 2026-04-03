
ALTER TABLE public.debtors ADD COLUMN IF NOT EXISTS sheet_sync_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.debtors.sheet_sync_enabled IS 'Controls whether this account can be updated via Google Sheets pull sync';
