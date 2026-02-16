
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS receive_daily_digest boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS receive_product_updates boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS receive_collection_alerts boolean NOT NULL DEFAULT true;
