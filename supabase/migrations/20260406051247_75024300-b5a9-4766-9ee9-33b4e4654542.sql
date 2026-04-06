
-- Remove duplicate inbound_emails, keeping the earliest one per email_id
DELETE FROM inbound_emails
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY email_id ORDER BY created_at ASC) as rn
    FROM inbound_emails
    WHERE email_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Add unique index on email_id to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_inbound_emails_email_id_unique 
ON inbound_emails (email_id) 
WHERE email_id IS NOT NULL;
