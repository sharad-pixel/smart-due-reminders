-- Create plans table
CREATE TABLE public.plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  monthly_price INTEGER,
  invoice_limit INTEGER,
  feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read plans (public pricing page)
CREATE POLICY "Plans are viewable by everyone"
ON public.plans
FOR SELECT
USING (true);

-- Add columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN plan_id UUID REFERENCES public.plans(id),
ADD COLUMN trial_ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN stripe_subscription_id TEXT;

-- Create index on plan_id
CREATE INDEX idx_profiles_plan_id ON public.profiles(plan_id);

-- Create trigger for plans updated_at
CREATE TRIGGER update_plans_updated_at
BEFORE UPDATE ON public.plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Pre-seed the plans
INSERT INTO public.plans (name, monthly_price, invoice_limit, feature_flags) VALUES
('starter', 39, 50, '{"sms_auto": false, "crm": false, "team_users": false, "cadence_automation": false}'::jsonb),
('growth', 99, 200, '{"sms_auto": true, "crm": false, "team_users": false, "cadence_automation": true}'::jsonb),
('professional', 199, NULL, '{"sms_auto": true, "crm": true, "team_users": true, "cadence_automation": true}'::jsonb),
('bespoke', NULL, NULL, '{"sms_auto": true, "crm": true, "team_users": true, "cadence_automation": true, "api_access": true}'::jsonb);

-- Create contact_requests table for bespoke plan inquiries
CREATE TABLE public.contact_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  billing_system TEXT,
  monthly_invoices TEXT,
  team_size TEXT,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert contact requests
CREATE POLICY "Anyone can create contact requests"
ON public.contact_requests
FOR INSERT
WITH CHECK (true);