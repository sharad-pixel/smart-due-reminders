-- Add auto_send_outreach column to debtors table for controlling auto-send vs review mode
ALTER TABLE public.debtors
ADD COLUMN IF NOT EXISTS auto_send_outreach boolean DEFAULT false;

COMMENT ON COLUMN public.debtors.auto_send_outreach IS 'If true, account-level outreach is sent automatically. If false, drafts require manual review/approval.';