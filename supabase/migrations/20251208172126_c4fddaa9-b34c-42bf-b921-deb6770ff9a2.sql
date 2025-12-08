-- Add AR page settings and branding enhancements to branding_settings
ALTER TABLE public.branding_settings
ADD COLUMN IF NOT EXISTS ar_page_public_token uuid DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS ar_page_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#6366f1',
ADD COLUMN IF NOT EXISTS footer_disclaimer text,
ADD COLUMN IF NOT EXISTS escalation_contact_name text,
ADD COLUMN IF NOT EXISTS escalation_contact_email text,
ADD COLUMN IF NOT EXISTS escalation_contact_phone text,
ADD COLUMN IF NOT EXISTS ar_contact_email text,
ADD COLUMN IF NOT EXISTS supported_payment_methods jsonb DEFAULT '["ACH", "Wire", "Credit Card"]'::jsonb,
ADD COLUMN IF NOT EXISTS stripe_payment_link text,
ADD COLUMN IF NOT EXISTS ar_page_last_updated_at timestamptz DEFAULT now();

-- Add public visibility flag to documents table
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS public_visible boolean DEFAULT false;

-- Create AR page access logs table for audit
CREATE TABLE IF NOT EXISTS public.ar_page_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branding_settings_id uuid REFERENCES public.branding_settings(id) ON DELETE CASCADE,
  accessed_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text
);

-- Enable RLS on access logs
ALTER TABLE public.ar_page_access_logs ENABLE ROW LEVEL SECURITY;

-- Allow public inserts for logging (no auth required)
CREATE POLICY "Allow public insert for access logging"
ON public.ar_page_access_logs
FOR INSERT
WITH CHECK (true);

-- Only account owners can view their access logs
CREATE POLICY "Account owners can view access logs"
ON public.ar_page_access_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.branding_settings bs
    WHERE bs.id = ar_page_access_logs.branding_settings_id
    AND can_access_account_data(auth.uid(), bs.user_id)
  )
);

-- Function to get public AR page data by token (no auth required)
CREATE OR REPLACE FUNCTION public.get_public_ar_page(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_branding_id uuid;
BEGIN
  -- Get branding settings by token
  SELECT id INTO v_branding_id
  FROM branding_settings
  WHERE ar_page_public_token = p_token
    AND ar_page_enabled = true;

  IF v_branding_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Page not found or disabled');
  END IF;

  -- Build the result
  SELECT jsonb_build_object(
    'branding', jsonb_build_object(
      'id', bs.id,
      'business_name', bs.business_name,
      'logo_url', bs.logo_url,
      'primary_color', bs.primary_color,
      'accent_color', bs.accent_color,
      'ar_contact_email', bs.ar_contact_email,
      'escalation_contact_name', bs.escalation_contact_name,
      'escalation_contact_email', bs.escalation_contact_email,
      'escalation_contact_phone', bs.escalation_contact_phone,
      'supported_payment_methods', bs.supported_payment_methods,
      'stripe_payment_link', bs.stripe_payment_link,
      'footer_disclaimer', bs.footer_disclaimer,
      'ar_page_last_updated_at', bs.ar_page_last_updated_at
    ),
    'documents', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'file_name', d.file_name,
          'file_url', d.file_url,
          'category', d.category,
          'status', d.status,
          'expires_at', d.expires_at,
          'updated_at', d.updated_at
        )
      ), '[]'::jsonb)
      FROM documents d
      WHERE d.organization_id = bs.user_id
        AND d.public_visible = true
    )
  ) INTO v_result
  FROM branding_settings bs
  WHERE bs.id = v_branding_id;

  RETURN v_result;
END;
$$;

-- Function to rotate public token
CREATE OR REPLACE FUNCTION public.rotate_ar_page_token(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_token uuid;
BEGIN
  v_new_token := gen_random_uuid();
  
  UPDATE branding_settings
  SET ar_page_public_token = v_new_token,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN v_new_token;
END;
$$;