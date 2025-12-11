-- Update the field label to "Account Name" to match platform terminology
UPDATE public.data_center_field_definitions
SET label = 'Account Name'
WHERE key = 'customer_name' AND grouping = 'customer';