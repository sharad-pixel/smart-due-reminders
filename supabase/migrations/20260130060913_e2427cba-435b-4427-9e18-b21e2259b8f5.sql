-- Add 'cancelled' to the draft_status enum
ALTER TYPE draft_status ADD VALUE IF NOT EXISTS 'cancelled';