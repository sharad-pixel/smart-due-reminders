-- For accounts uploads, recouply_account_id should NOT be required since new accounts don't have one yet
-- It's only required for invoice and payment uploads to match to existing accounts
-- Add a new column to track which file types require this field

-- First, let's update the recouply_account_id to not be universally required
-- The logic in the code will handle it per file type
UPDATE data_center_field_definitions 
SET required_for_recouply = false,
    description = 'Recouply Account ID - Required for invoice and payment uploads to match to existing accounts. Leave empty for new account imports.'
WHERE key = 'recouply_account_id';

-- Add account_name as a required field for account imports (since we need at least a name)
UPDATE data_center_field_definitions 
SET required_for_recouply = true,
    description = 'Account name - Required for new account creation'
WHERE key = 'account_name';