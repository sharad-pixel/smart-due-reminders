-- Add name column to waitlist_signups table
ALTER TABLE public.waitlist_signups ADD COLUMN IF NOT EXISTS name TEXT;