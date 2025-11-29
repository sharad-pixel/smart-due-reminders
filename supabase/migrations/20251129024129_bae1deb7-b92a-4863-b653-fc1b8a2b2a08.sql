-- Add email_type to distinguish between outbound and inbound email accounts
ALTER TABLE email_accounts 
ADD COLUMN IF NOT EXISTS email_type TEXT DEFAULT 'outbound' CHECK (email_type IN ('outbound', 'inbound'));

-- Add comment for clarity
COMMENT ON COLUMN email_accounts.email_type IS 'Type of email account: outbound for sending, inbound for receiving responses';