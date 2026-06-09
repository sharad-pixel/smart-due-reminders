CREATE OR REPLACE FUNCTION public.merge_debtors(p_primary_debtor_id uuid, p_duplicate_debtor_ids uuid[], p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  dup_id uuid;
  v_invoices_moved integer := 0;
  v_payments_moved integer := 0;
  v_activities_moved integer := 0;
  v_contacts_moved integer := 0;
  v_contacts_deduped integer := 0;
  v_debtors_removed integer := 0;
  v_org_id uuid;
  v_tmp integer;
  v_primary_has_primary_contact boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM debtors WHERE id = p_primary_debtor_id AND user_id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Primary debtor not found or access denied');
  END IF;

  SELECT public.get_user_organization_id(p_user_id) INTO v_org_id;

  FOREACH dup_id IN ARRAY p_duplicate_debtor_ids
  LOOP
    IF dup_id = p_primary_debtor_id THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM debtors WHERE id = dup_id AND user_id = p_user_id) THEN CONTINUE; END IF;

    UPDATE invoices SET debtor_id = p_primary_debtor_id WHERE debtor_id = dup_id;
    GET DIAGNOSTICS v_tmp = ROW_COUNT;
    v_invoices_moved := v_invoices_moved + v_tmp;

    UPDATE payments SET debtor_id = p_primary_debtor_id WHERE debtor_id = dup_id;
    GET DIAGNOSTICS v_tmp = ROW_COUNT;
    v_payments_moved := v_payments_moved + v_tmp;

    UPDATE collection_activities SET debtor_id = p_primary_debtor_id WHERE debtor_id = dup_id;
    GET DIAGNOSTICS v_tmp = ROW_COUNT;
    v_activities_moved := v_activities_moved + v_tmp;

    UPDATE collection_tasks SET debtor_id = p_primary_debtor_id WHERE debtor_id = dup_id;
    UPDATE collection_outcomes SET debtor_id = p_primary_debtor_id WHERE debtor_id = dup_id;

    UPDATE contacts SET debtor_id = p_primary_debtor_id 
    WHERE debtor_id = dup_id
      AND (
        email IS NULL 
        OR LOWER(TRIM(email)) NOT IN (
          SELECT LOWER(TRIM(c2.email)) FROM contacts c2 
          WHERE c2.debtor_id = p_primary_debtor_id AND c2.email IS NOT NULL
        )
      );
    GET DIAGNOSTICS v_tmp = ROW_COUNT;
    v_contacts_moved := v_contacts_moved + v_tmp;

    SELECT COUNT(*) INTO v_tmp FROM contacts WHERE debtor_id = dup_id;
    v_contacts_deduped := v_contacts_deduped + v_tmp;
    DELETE FROM contacts WHERE debtor_id = dup_id;

    -- DEBTOR_CONTACTS: demote primary flag on dup contacts if primary already has one
    SELECT EXISTS (
      SELECT 1 FROM debtor_contacts 
      WHERE debtor_id = p_primary_debtor_id AND is_primary = true
    ) INTO v_primary_has_primary_contact;

    IF v_primary_has_primary_contact THEN
      UPDATE debtor_contacts SET is_primary = false 
      WHERE debtor_id = dup_id AND is_primary = true;
    END IF;

    UPDATE debtor_contacts SET debtor_id = p_primary_debtor_id 
    WHERE debtor_id = dup_id
      AND (
        email IS NULL
        OR LOWER(TRIM(email)) NOT IN (
          SELECT LOWER(TRIM(dc2.email)) FROM debtor_contacts dc2 
          WHERE dc2.debtor_id = p_primary_debtor_id AND dc2.email IS NOT NULL
        )
      );
    DELETE FROM debtor_contacts WHERE debtor_id = dup_id;

    UPDATE campaign_accounts SET debtor_id = p_primary_debtor_id WHERE debtor_id = dup_id
      AND NOT EXISTS (
        SELECT 1 FROM campaign_accounts ca2 WHERE ca2.debtor_id = p_primary_debtor_id AND ca2.campaign_id = campaign_accounts.campaign_id
      );
    DELETE FROM campaign_accounts WHERE debtor_id = dup_id;

    UPDATE cs_cases SET debtor_id = p_primary_debtor_id WHERE debtor_id = dup_id;
    UPDATE ar_summary SET debtor_id = p_primary_debtor_id WHERE debtor_id = dup_id;

    UPDATE debtors SET is_archived = true, notes = COALESCE(notes, '') || E'\n[Merged into ' || p_primary_debtor_id::text || ' on ' || now()::date::text || ']' WHERE id = dup_id;
    v_debtors_removed := v_debtors_removed + 1;

    INSERT INTO audit_logs (user_id, action_type, resource_type, resource_id, old_values, new_values, metadata)
    VALUES (
      p_user_id, 'merge', 'debtor', dup_id,
      jsonb_build_object('debtor_id', dup_id),
      jsonb_build_object('merged_into', p_primary_debtor_id),
      jsonb_build_object('invoices_moved', v_invoices_moved, 'payments_moved', v_payments_moved)
    );
  END LOOP;

  PERFORM public.recalculate_debtor_balances(p_primary_debtor_id);

  RETURN jsonb_build_object(
    'success', true,
    'invoices_moved', v_invoices_moved,
    'payments_moved', v_payments_moved,
    'activities_moved', v_activities_moved,
    'contacts_moved', v_contacts_moved,
    'contacts_deduped', v_contacts_deduped,
    'debtors_removed', v_debtors_removed
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;