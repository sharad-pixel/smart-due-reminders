-- Add 'professional' to the plan_type enum if it doesn't exist
ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'professional';