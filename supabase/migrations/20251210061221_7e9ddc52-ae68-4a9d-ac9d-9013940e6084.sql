-- Update field definitions to match the Data Center page requirements
-- For Accounts: customer_name and customer_email should be required (RAID is auto-generated)
-- For Invoices: recouply_account_id, invoice_number, amount_original, invoice_date, due_date are required
-- For Payments: recouply_invoice_id, payment_invoice_number, payment_amount, payment_date are required

-- Make customer_name required for accounts
UPDATE data_center_field_definitions 
SET required_for_recouply = true 
WHERE key = 'customer_name';

-- Make customer_email required for accounts  
UPDATE data_center_field_definitions 
SET required_for_recouply = true 
WHERE key = 'customer_email';

-- Ensure invoice_date is required (it should already be)
UPDATE data_center_field_definitions 
SET required_for_recouply = true 
WHERE key = 'invoice_date';

-- Ensure payment_date is required
UPDATE data_center_field_definitions 
SET required_for_recouply = true 
WHERE key = 'payment_date';

-- Update descriptions for clarity
UPDATE data_center_field_definitions 
SET description = 'Required. Name of the customer or company.' 
WHERE key = 'customer_name';

UPDATE data_center_field_definitions 
SET description = 'Required. Primary email address for collection outreach.' 
WHERE key = 'customer_email';

UPDATE data_center_field_definitions 
SET description = 'Unique Recouply identifier for the account. Auto-generated for new accounts, required for invoice/payment imports.' 
WHERE key = 'recouply_account_id';