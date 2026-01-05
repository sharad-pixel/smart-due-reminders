-- Add 'sent' and 'skipped' values to draft_status enum
ALTER TYPE draft_status ADD VALUE IF NOT EXISTS 'sent';
ALTER TYPE draft_status ADD VALUE IF NOT EXISTS 'skipped';