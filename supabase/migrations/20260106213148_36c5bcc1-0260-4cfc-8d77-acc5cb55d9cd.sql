-- Fix the get_public_ar_page function to handle cases where organization_id is null
-- and fall back to matching by user_id (uploaded_by_user_id)
CREATE OR REPLACE FUNCTION public.get_public_ar_page(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_branding_id uuid;
  v_organization_id uuid;
  v_user_id uuid;
BEGIN
  -- Get branding settings by token (cast text to uuid)
  SELECT id, organization_id, user_id INTO v_branding_id, v_organization_id, v_user_id
  FROM branding_settings
  WHERE ar_page_public_token = p_token::uuid
    AND ar_page_enabled = true;

  IF v_branding_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Page not found or disabled');
  END IF;

  -- Build the result - return verified documents that are public_visible
  -- Match by organization_id if available, otherwise by user_id
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
      WHERE d.public_visible = true
        AND d.status = 'verified'
        AND (
          -- Match by organization_id if the branding has one
          (v_organization_id IS NOT NULL AND d.organization_id = v_organization_id)
          OR
          -- Otherwise match by the user who uploaded the document
          (v_organization_id IS NULL AND d.uploaded_by_user_id = v_user_id)
        )
    )
  ) INTO v_result
  FROM branding_settings bs
  WHERE bs.id = v_branding_id;

  RETURN v_result;
END;
$$;