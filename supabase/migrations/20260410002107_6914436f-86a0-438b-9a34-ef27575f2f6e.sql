ALTER TABLE public.invoice_templates
  ADD COLUMN show_payment_qr_codes boolean DEFAULT false,
  ADD COLUMN qr_code_venmo_url text,
  ADD COLUMN qr_code_stripe_url text,
  ADD COLUMN qr_code_paypal_url text,
  ADD COLUMN qr_code_cashapp_url text;