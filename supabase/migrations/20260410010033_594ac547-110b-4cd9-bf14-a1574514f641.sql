
-- Add public_token to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS public_token UUID DEFAULT gen_random_uuid();

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_public_token ON public.invoices(public_token) WHERE public_token IS NOT NULL;

-- Backfill existing invoices that may have NULL tokens
UPDATE public.invoices SET public_token = gen_random_uuid() WHERE public_token IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE public.invoices ALTER COLUMN public_token SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN public_token SET DEFAULT gen_random_uuid();

-- Add public_invoice_links_enabled to branding_settings
ALTER TABLE public.branding_settings ADD COLUMN IF NOT EXISTS public_invoice_links_enabled BOOLEAN DEFAULT false;

-- Create a security definer function to fetch public invoice data (no auth required)
CREATE OR REPLACE FUNCTION public.get_public_invoice(p_token UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_enabled boolean;
BEGIN
  -- Check if the invoice owner has public links enabled
  SELECT bs.public_invoice_links_enabled INTO v_enabled
  FROM invoices i
  JOIN branding_settings bs ON bs.user_id = i.user_id
  WHERE i.public_token = p_token;

  IF v_enabled IS NOT TRUE THEN
    RETURN jsonb_build_object('error', 'Public invoice links are not enabled');
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
      'zip', d.zip
    ),
    'branding', jsonb_build_object(
      'business_name', bs.business_name,
      'logo_url', bs.logo_url,
      'primary_color', bs.primary_color,
      'accent_color', bs.accent_color,
      'stripe_payment_link', bs.stripe_payment_link,
      'footer_disclaimer', bs.footer_disclaimer
    ),
    'template', (
      SELECT jsonb_build_object(
        'company_address', it.company_address,
        'company_phone', it.company_phone,
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
      WHERE it.user_id = i.user_id
      LIMIT 1
    )
  ) INTO v_result
  FROM invoices i
  LEFT JOIN debtors d ON d.id = i.debtor_id
  LEFT JOIN branding_settings bs ON bs.user_id = i.user_id
  WHERE i.public_token = p_token;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('error', 'Invoice not found');
  END IF;

  RETURN v_result;
END;
$$;
