
-- Extend revisions with risk + category + clarification + resolved
ALTER TABLE public.clm_section_revisions
  ADD COLUMN IF NOT EXISTS risk_level text DEFAULT 'low' CHECK (risk_level IN ('low','medium','high')),
  ADD COLUMN IF NOT EXISTS change_category text DEFAULT 'other' CHECK (change_category IN ('legal','commercial','security','pricing','compliance','formatting','other')),
  ADD COLUMN IF NOT EXISTS clarification_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS clarification_question text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid;

-- Extend approval requests with category + assignee + due + delegation + changes_requested status
ALTER TABLE public.clm_approval_requests
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS assignee_email text,
  ADD COLUMN IF NOT EXISTS assignee_name text,
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS delegated_to_email text,
  ADD COLUMN IF NOT EXISTS revision_id uuid;

-- Drop old status check if present, add expanded one
DO $$ BEGIN
  ALTER TABLE public.clm_approval_requests DROP CONSTRAINT IF EXISTS clm_approval_requests_status_check;
EXCEPTION WHEN others THEN NULL; END $$;
ALTER TABLE public.clm_approval_requests
  ADD CONSTRAINT clm_approval_requests_status_check
  CHECK (status IN ('pending','approved','rejected','changes_requested','delegated','expired'));

-- Finalization tracking
CREATE TABLE IF NOT EXISTS public.clm_instance_finalization (
  instance_id uuid PRIMARY KEY,
  account_id uuid NOT NULL,
  ready_for_signature boolean NOT NULL DEFAULT false,
  final_approved_at timestamptz,
  final_approved_by uuid,
  final_approved_by_name text,
  locked_version_id uuid,
  readiness_score int NOT NULL DEFAULT 0,
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clm_instance_finalization ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finalization read" ON public.clm_instance_finalization
  FOR SELECT TO authenticated
  USING (public.can_access_account_data(auth.uid(), account_id));
CREATE POLICY "finalization write" ON public.clm_instance_finalization
  FOR ALL TO authenticated
  USING (public.can_write_as_account(auth.uid(), account_id))
  WITH CHECK (public.can_write_as_account(auth.uid(), account_id));

-- Auto-categorize trigger for revisions
CREATE OR REPLACE FUNCTION public.clm_auto_categorize_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  k text := lower(coalesce(NEW.section_key,'') || ' ' || coalesce(NEW.section_title,''));
BEGIN
  IF NEW.change_category IS NULL OR NEW.change_category = 'other' THEN
    NEW.change_category :=
      CASE
        WHEN k ~ '(liability|indemnif|termination|governing|warrant|jurisdiction|dispute)' THEN 'legal'
        WHEN k ~ '(price|pricing|payment|discount|fee|overage|ramp|invoice|billing)' THEN 'pricing'
        WHEN k ~ '(security|encryption|breach|access control|soc2|iso|pen test)' THEN 'security'
        WHEN k ~ '(hipaa|baa|dpa|gdpr|ccpa|privacy|compliance|phi|pii)' THEN 'compliance'
        WHEN k ~ '(term|renewal|sla|scope|deliverable|service level)' THEN 'commercial'
        WHEN k ~ '(format|typo|grammar|punctuation|whitespace)' THEN 'formatting'
        ELSE 'other'
      END;
  END IF;
  IF NEW.risk_level IS NULL OR NEW.risk_level = 'low' THEN
    NEW.risk_level :=
      CASE NEW.change_category
        WHEN 'legal' THEN 'high'
        WHEN 'compliance' THEN 'high'
        WHEN 'security' THEN 'high'
        WHEN 'pricing' THEN 'medium'
        WHEN 'commercial' THEN 'medium'
        ELSE 'low'
      END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clm_revisions_autocat ON public.clm_section_revisions;
CREATE TRIGGER clm_revisions_autocat
  BEFORE INSERT OR UPDATE OF section_key, section_title ON public.clm_section_revisions
  FOR EACH ROW EXECUTE FUNCTION public.clm_auto_categorize_revision();

-- Backfill existing rows
UPDATE public.clm_section_revisions
SET change_category = change_category, risk_level = risk_level
WHERE change_category IS NULL OR risk_level IS NULL;

-- Readiness compute RPC
CREATE OR REPLACE FUNCTION public.clm_compute_readiness(p_instance_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_account uuid;
  v_open_revs int;
  v_high_pending int;
  v_pending_approvals int;
  v_total_approvals int;
  v_approved_approvals int;
  v_score int;
  v_blockers jsonb := '[]'::jsonb;
  v_by_cat jsonb;
BEGIN
  SELECT account_id INTO v_account FROM public.clm_template_instances WHERE id = p_instance_id;
  IF v_account IS NULL OR NOT public.can_access_account_data(auth.uid(), v_account) THEN
    RETURN jsonb_build_object('score',0,'blockers','[]'::jsonb,'by_category','{}'::jsonb);
  END IF;

  SELECT count(*) INTO v_open_revs FROM public.clm_section_revisions
    WHERE instance_id = p_instance_id AND approval_status = 'pending' AND coalesce(merge_status,'') <> 'reverted';
  SELECT count(*) INTO v_high_pending FROM public.clm_section_revisions
    WHERE instance_id = p_instance_id AND approval_status = 'pending' AND risk_level = 'high';

  SELECT count(*), count(*) FILTER (WHERE status='approved'), count(*) FILTER (WHERE status='pending')
    INTO v_total_approvals, v_approved_approvals, v_pending_approvals
    FROM public.clm_approval_requests WHERE instance_id = p_instance_id;

  SELECT jsonb_object_agg(category, jsonb_build_object(
    'total', total, 'approved', approved, 'pending', pending, 'rejected', rejected
  )) INTO v_by_cat FROM (
    SELECT coalesce(category,'other') as category,
      count(*) total,
      count(*) FILTER (WHERE status='approved') approved,
      count(*) FILTER (WHERE status='pending') pending,
      count(*) FILTER (WHERE status='rejected') rejected
    FROM public.clm_approval_requests WHERE instance_id = p_instance_id
    GROUP BY 1
  ) s;

  IF v_open_revs > 0 THEN
    v_blockers := v_blockers || jsonb_build_object('type','open_suggestions','count',v_open_revs,'message', v_open_revs || ' open suggestion(s)');
  END IF;
  IF v_pending_approvals > 0 THEN
    v_blockers := v_blockers || jsonb_build_object('type','pending_approvals','count',v_pending_approvals,'message', v_pending_approvals || ' pending approval(s)');
  END IF;
  IF v_high_pending > 0 THEN
    v_blockers := v_blockers || jsonb_build_object('type','high_risk','count',v_high_pending,'message', v_high_pending || ' high-risk change(s) need approval');
  END IF;

  v_score := 100;
  IF v_open_revs > 0 THEN v_score := v_score - least(40, v_open_revs * 8); END IF;
  IF v_total_approvals > 0 AND v_pending_approvals > 0 THEN
    v_score := v_score - least(50, (v_pending_approvals * 100 / greatest(v_total_approvals,1)) / 2);
  END IF;
  IF v_high_pending > 0 THEN v_score := v_score - 10; END IF;
  v_score := greatest(0, least(100, v_score));

  RETURN jsonb_build_object(
    'score', v_score,
    'open_suggestions', v_open_revs,
    'pending_approvals', v_pending_approvals,
    'total_approvals', v_total_approvals,
    'approved_approvals', v_approved_approvals,
    'high_pending', v_high_pending,
    'blockers', v_blockers,
    'by_category', coalesce(v_by_cat,'{}'::jsonb)
  );
END;
$$;

-- Finalize RPC
CREATE OR REPLACE FUNCTION public.clm_finalize_instance(p_instance_id uuid, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_account uuid;
  v_readiness jsonb;
  v_user uuid := auth.uid();
  v_name text;
  v_version_id uuid;
BEGIN
  SELECT account_id INTO v_account FROM public.clm_template_instances WHERE id = p_instance_id;
  IF v_account IS NULL OR NOT public.can_write_as_account(v_user, v_account) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_readiness := public.clm_compute_readiness(p_instance_id);
  IF (v_readiness->>'score')::int < 100 THEN
    RAISE EXCEPTION 'workspace not ready: score=%', v_readiness->>'score';
  END IF;

  SELECT coalesce(raw_user_meta_data->>'full_name', email) INTO v_name FROM auth.users WHERE id = v_user;

  -- Seal pending revisions that were approved
  UPDATE public.clm_section_revisions
    SET sealed_at = now()
    WHERE instance_id = p_instance_id AND approval_status = 'approved' AND sealed_at IS NULL;

  -- Snapshot a final version row
  INSERT INTO public.clm_document_versions (
    instance_id, version_number, label, status, snapshot_sections,
    created_by, created_by_name, lifecycle_label, signed_sealed
  )
  SELECT p_instance_id,
    coalesce((SELECT max(version_number) FROM public.clm_document_versions WHERE instance_id = p_instance_id),0)+1,
    'Final Executable',
    'approved',
    coalesce((SELECT jsonb_agg(row_to_json(s)) FROM public.clm_instance_sections s WHERE s.instance_id = p_instance_id),'[]'::jsonb),
    v_user, v_name, 'Ready for Signature', true
  RETURNING id INTO v_version_id;

  INSERT INTO public.clm_instance_finalization (instance_id, account_id, ready_for_signature, final_approved_at, final_approved_by, final_approved_by_name, locked_version_id, readiness_score, blockers, updated_at)
    VALUES (p_instance_id, v_account, true, now(), v_user, v_name, v_version_id, 100, '[]'::jsonb, now())
    ON CONFLICT (instance_id) DO UPDATE SET
      ready_for_signature = true, final_approved_at = now(), final_approved_by = v_user,
      final_approved_by_name = v_name, locked_version_id = v_version_id, readiness_score = 100,
      blockers = '[]'::jsonb, updated_at = now();

  UPDATE public.clm_template_instances SET status = 'approved', updated_at = now() WHERE id = p_instance_id;

  INSERT INTO public.clm_audit_log (instance_id, event_type, actor_id, actor_name, payload)
    VALUES (p_instance_id, 'final_approval', v_user, v_name, jsonb_build_object('version_id', v_version_id, 'note', p_note));

  RETURN jsonb_build_object('ok', true, 'version_id', v_version_id);
END;
$$;

CREATE INDEX IF NOT EXISTS idx_clm_revisions_instance_status ON public.clm_section_revisions(instance_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_clm_revisions_category ON public.clm_section_revisions(change_category);
CREATE INDEX IF NOT EXISTS idx_clm_approval_req_instance_status ON public.clm_approval_requests(instance_id, status);
