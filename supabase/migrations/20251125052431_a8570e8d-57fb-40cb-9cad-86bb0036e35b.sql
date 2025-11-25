-- Add is_primary column to email_accounts table
ALTER TABLE email_accounts 
ADD COLUMN is_primary BOOLEAN DEFAULT false;

-- Create index for faster queries on primary email accounts
CREATE INDEX idx_email_accounts_is_primary ON email_accounts(user_id, is_primary) WHERE is_primary = true;

-- Add comment explaining the column
COMMENT ON COLUMN email_accounts.is_primary IS 'Indicates if this is the primary/default email account for sending';