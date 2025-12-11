-- Update the field label from "Customer Name" to "Company Name" to match New Account Card
UPDATE public.data_center_field_definitions
SET label = 'Company Name'
WHERE key = 'customer_name' AND grouping = 'customer';