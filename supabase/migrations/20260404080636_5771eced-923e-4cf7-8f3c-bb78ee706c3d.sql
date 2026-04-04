
CREATE OR REPLACE FUNCTION public.get_payment_plan_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'plan', jsonb_build_object(
      'id', pp.id,
      'plan_name', pp.plan_name,
      'total_amount', pp.total_amount,
      'number_of_installments', pp.number_of_installments,
      'installment_amount', pp.installment_amount,
      'frequency', pp.frequency,
      'start_date', pp.start_date,
      'status', pp.status,
      'currency', pp.currency,
      'proposed_at', pp.proposed_at,
      'accepted_at', pp.accepted_at,
      'notes', pp.notes,
      'created_at', pp.created_at,
      'requires_dual_approval', pp.requires_dual_approval,
      'debtor_approved_at', pp.debtor_approved_at,
      'admin_approved_at', pp.admin_approved_at
    ),
    'debtor', jsonb_build_object(
      'company_name', d.company_name,
      'reference_id', d.reference_id
    ),
    'branding', jsonb_build_object(
      'business_name', bs.business_name,
      'logo_url', bs.logo_url,
      'primary_color', bs.primary_color,
      'accent_color', bs.accent_color,
      'stripe_payment_link', bs.stripe_payment_link,
      'footer_disclaimer', bs.footer_disclaimer
    ),
    'installments', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', pi.id,
        'installment_number', pi.installment_number,
        'amount', pi.amount,
        'due_date', pi.due_date,
        'status', pi.status,
        'paid_at', pi.paid_at
      ) ORDER BY pi.installment_number), '[]'::jsonb)
      FROM payment_plan_installments pi
      WHERE pi.payment_plan_id = pp.id
    )
  ) INTO v_result
  FROM payment_plans pp
  LEFT JOIN debtors d ON d.id = pp.debtor_id
  LEFT JOIN branding_settings bs ON bs.user_id = pp.user_id
  WHERE pp.public_token = p_token
    AND pp.status NOT IN ('cancelled');

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('error', 'Plan not found');
  END IF;

  RETURN v_result;
END;
$$;
