-- Add recouply_invoice_id field definition for payment imports
INSERT INTO data_center_field_definitions (key, label, data_type, grouping, description, required_for_recouply, required_for_roundtrip)
VALUES ('recouply_invoice_id', 'Recouply Invoice ID', 'string', 'payment', 'Recouply Invoice ID for matching payments to invoices (use reference_id from invoice export)', true, false)
ON CONFLICT (key) DO UPDATE SET 
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  required_for_recouply = EXCLUDED.required_for_recouply;