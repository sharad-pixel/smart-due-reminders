-- Add product_description column to invoices table
ALTER TABLE invoices
ADD COLUMN product_description TEXT;