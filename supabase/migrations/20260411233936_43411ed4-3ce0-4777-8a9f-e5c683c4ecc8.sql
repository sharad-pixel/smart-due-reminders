CREATE OR REPLACE FUNCTION public.get_public_invoice(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_enabled boolean;
  v_invoice_user_id uuid;
  v_effective_account_id uuid;
  v_company_address text;
BEGIN
  SELECT i.user_id INTO v_invoice_user_id
  FROM invoices i
  WHERE i.public_token = p_token;

  IF v_invoice_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invoice not found');
  END IF;

  SELECT au.account_id INTO v_effective_account_id
  FROM account_users au
  WHERE au.user_id = v_invoice_user_id
    AND au.status = 'active'
  ORDER BY au.is_owner DESC NULLS LAST
  LIMIT 1;

  v_effective_account_id := COALESCE(v_effective_account_id, v_invoice_user_id);

  SELECT bs.public_invoice_links_enabled INTO v_enabled
  FROM branding_settings bs
  WHERE bs.user_id = v_effective_account_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN jsonb_build_object('error', 'Public invoice links are not enabled');
  END IF;

  -- Build company address: prefer invoice_templates.company_address, fall back to profile address
  SELECT COALESCE(
    NULLIF(it.company_address, ''),
    (
      SELECT array_to_string(
        ARRAY(
          SELECT unnest FROM unnest(ARRAY[
            p.business_address_line1,
            p.business_address_line2,
            NULLIF(CONCAT_WS(', ', p.business_city, p.business_state), ''),
            p.business_postal_code
          ]) WHERE unnest IS NOT NULL AND unnest != ''
        ),
        E'\n'
      )
      FROM profiles p
      WHERE p.id = v_effective_account_id
    )
  ) INTO v_company_address
  FROM invoice_templates it
  WHERE it.user_id = v_effective_account_id;

  -- If no template exists, still try profile address
  IF v_company_address IS NULL THEN
    SELECT array_to_string(
      ARRAY(
        SELECT unnest FROM unnest(ARRAY[
          p.business_address_line1,
          p.business_address_line2,
          NULLIF(CONCAT_WS(', ', p.business_city, p.business_state), ''),
          p.business_postal_code
        ]) WHERE unnest IS NOT NULL AND unnest != ''
      ),
      E'\n'
    ) INTO v_company_address
    FROM profiles p
    WHERE p.id = v_effective_account_id;
  END IF;

  SELECT jsonb_build_object(
    'invoice', jsonb_build_object(
      'id', i.id,
      'invoice_number', i.invoice_number,
      'reference_id', i.reference_id,
      'amount', i.amount,
      'amount_outstanding', i.amount_outstanding,
      'subtotal', i.subtotal,
      'tax_amount', i.tax_amount,
      'total_amount', i.total_amount,
      'due_date', i.due_date,
      'issue_date', i.issue_date,
      'status', i.status,
      'payment_terms', i.payment_terms,
      'currency', i.currency,
      'product_description', i.product_description,
      'po_number', i.po_number,
      'paid_date', i.paid_date
    ),
    'debtor', jsonb_build_object(
      'company_name', d.company_name,
      'name', d.name,
      'address_line1', d.address_line1,
      'address_line2', d.address_line2,
      'city', d.city,
      'state', d.state,
      'zip', d.postal_code
    ),
    'branding', jsonb_build_object(
      'business_name', COALESCE(
        (SELECT p.business_name FROM profiles p WHERE p.id = v_effective_account_id),
        bs.business_name
      ),
      'logo_url', bs.logo_url,
      'primary_color', bs.primary_color,
      'accent_color', bs.accent_color,
      'stripe_payment_link', bs.stripe_payment_link,
      'footer_disclaimer', bs.footer_disclaimer
    ),
    'template', (
      SELECT jsonb_build_object(
        'company_address', v_company_address,
        'company_phone', COALESCE(it.company_phone, (SELECT p.business_phone FROM profiles p WHERE p.id = v_effective_account_id)),
        'company_website', it.company_website,
        'show_logo', it.show_logo,
        'show_po_number', it.show_po_number,
        'show_sales_rep', it.show_sales_rep,
        'show_tax', it.show_tax,
        'show_payment_instructions', it.show_payment_instructions,
        'show_payment_qr_codes', it.show_payment_qr_codes,
        'header_color', it.header_color,
        'payment_instructions_wire', it.payment_instructions_wire,
        'payment_instructions_check', it.payment_instructions_check,
        'footer_note', it.footer_note,
        'font_style', it.font_style,
        'qr_code_venmo_url', it.qr_code_venmo_url,
        'qr_code_stripe_url', it.qr_code_stripe_url,
        'qr_code_paypal_url', it.qr_code_paypal_url,
        'qr_code_cashapp_url', it.qr_code_cashapp_url
      )
      FROM invoice_templates it
      WHERE it.user_id = v_effective_account_id
      LIMIT 1
    )
  ) INTO v_result
  FROM invoices i
  LEFT JOIN debtors d ON d.id = i.debtor_id
  LEFT JOIN branding_settings bs ON bs.user_id = v_effective_account_id
  WHERE i.public_token = p_token;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('error', 'Invoice not found');
  END IF;

  RETURN v_result;
END;
$function$;