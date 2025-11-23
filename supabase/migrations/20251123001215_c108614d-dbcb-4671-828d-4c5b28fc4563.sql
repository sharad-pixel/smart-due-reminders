-- Add address autocomplete settings to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS address_autocomplete_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS address_autocomplete_provider text CHECK (address_autocomplete_provider IN ('google_places', 'mapbox')),
ADD COLUMN IF NOT EXISTS address_autocomplete_api_key text;

-- Add structured address fields to debtors if missing
ALTER TABLE public.debtors
ADD COLUMN IF NOT EXISTS address_line1 text,
ADD COLUMN IF NOT EXISTS address_line2 text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS postal_code text,
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS latitude numeric,
ADD COLUMN IF NOT EXISTS longitude numeric;

-- Add structured address fields to profiles for organization address
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS business_address_line1 text,
ADD COLUMN IF NOT EXISTS business_address_line2 text,
ADD COLUMN IF NOT EXISTS business_city text,
ADD COLUMN IF NOT EXISTS business_state text,
ADD COLUMN IF NOT EXISTS business_postal_code text,
ADD COLUMN IF NOT EXISTS business_country text;

-- Add comment for documentation
COMMENT ON COLUMN profiles.address_autocomplete_enabled IS 'Enable address autocomplete feature';
COMMENT ON COLUMN profiles.address_autocomplete_provider IS 'Address autocomplete provider: google_places or mapbox';
COMMENT ON COLUMN profiles.address_autocomplete_api_key IS 'Encrypted API key for address autocomplete provider';