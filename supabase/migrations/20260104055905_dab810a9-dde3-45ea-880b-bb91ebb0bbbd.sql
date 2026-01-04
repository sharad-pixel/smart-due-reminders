-- Add encrypted Stripe secret key column to stripe_integrations
ALTER TABLE public.stripe_integrations 
ADD COLUMN IF NOT EXISTS stripe_secret_key_encrypted text;

-- Add comment for documentation
COMMENT ON COLUMN public.stripe_integrations.stripe_secret_key_encrypted IS 'User-provided Stripe secret key (AES-256-GCM encrypted)';