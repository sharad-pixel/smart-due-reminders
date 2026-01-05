-- Add unique constraint to prevent duplicate drafts per invoice/step
ALTER TABLE ai_drafts 
ADD CONSTRAINT unique_invoice_step 
UNIQUE (invoice_id, step_number);