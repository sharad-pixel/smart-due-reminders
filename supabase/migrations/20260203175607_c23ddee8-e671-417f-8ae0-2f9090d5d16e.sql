-- Create system_config table for platform-wide settings
CREATE TABLE public.system_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read system config (needed for maintenance mode check)
CREATE POLICY "Anyone can read system config" 
ON public.system_config 
FOR SELECT 
USING (true);

-- Only admins can update (we'll check admin status in the app)
CREATE POLICY "Authenticated users can update system config" 
ON public.system_config 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert system config" 
ON public.system_config 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Insert default config values
INSERT INTO public.system_config (key, value) VALUES
  ('maintenance_mode', 'false'::jsonb),
  ('signups_enabled', 'true'::jsonb),
  ('max_invoices_per_free_user', '5'::jsonb),
  ('email_notifications_enabled', 'true'::jsonb);