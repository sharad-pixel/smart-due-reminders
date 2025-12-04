-- Add required payment fields: recouply_account_id and invoice_number
INSERT INTO data_center_field_definitions (key, label, grouping, data_type, description, required_for_recouply, required_for_roundtrip)
VALUES 
  ('recouply_account_id', 'Recouply Account ID', 'payment', 'string', 'The Recouply Account ID to apply payment to', true, true),
  ('payment_invoice_number', 'Invoice Number', 'payment', 'string', 'Invoice number to apply payment to for settlement', true, true)
ON CONFLICT DO NOTHING;