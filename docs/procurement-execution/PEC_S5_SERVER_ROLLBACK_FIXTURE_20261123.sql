-- PEC S5 disposable production-shaped transaction fixture.
-- Load the registered S5 migration into a disposable transaction before this fixture.
-- This script never commits; all synthetic PR/data and DDL is ROLLED BACK.
DO $test$
DECLARE v_user uuid;v_preview jsonb;v_out jsonb;
  v_line bigint;v_old numeric;v_new numeric;v_reason text;v_failed boolean;
BEGIN
  SELECT user_id INTO v_user FROM public.user_permissions_canonical
  WHERE target='module:procurement-execution-console' AND can_view AND can_edit LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'No synthetic editor permission context'; END IF;
  PERFORM set_config('request.jwt.claim.sub',v_user::text,true);

  PERFORM public.proc_pec_ind_set_planned_requirement(
     2654,'2026-11-01',1000,'Synthetic integration requirement; rollback',true);
  v_preview:=public.proc_pec_s5_review_plan(
     '2026-11-01','2026-11-01',5,'normal','plan',false);
  IF (v_preview->>'total_candidates')::integer<>1
    OR (v_preview->'rows'->0->>'gate')<>'AUTO_ELIGIBLE'
    OR (v_preview->'rows'->0->>'recommended_qty')::numeric<=0
  THEN RAISE EXCEPTION 'IND plan preview did not return expected eligible quantity: %',v_preview; END IF;

  v_failed:=false;
  BEGIN
    PERFORM public.proc_pec_s5_generate_pr(
      'S5-ROLLBACK-TEST-20261123','2026-11-23','2026-11-01','2026-11-01',
      5,'normal','plan',false,'{}'::jsonb,'Disposable transaction test',
      '00000000000000000000000000000000',true);
  EXCEPTION WHEN OTHERS THEN
    v_failed:=SQLERRM LIKE '%evidence changed%';
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Stale review signature was not rejected'; END IF;
  IF EXISTS (SELECT 1 FROM public.proc_pr_header WHERE pr_number='S5-ROLLBACK-TEST-20261123')
  THEN RAISE EXCEPTION 'Rejected stale review wrote a PR'; END IF;

  v_out:=public.proc_pec_s5_generate_pr(
    'S5-ROLLBACK-TEST-20261123','2026-11-23','2026-11-01','2026-11-01',
    5,'normal','plan',false,'{}'::jsonb,'Disposable transaction test',
    v_preview->>'plan_signature',true);
  SELECT pr_line_id,requested_qty INTO v_line,v_old FROM public.proc_pr_line
  WHERE pr_id=(v_out->>'pr_id')::bigint AND stock_item_id=2654;
  IF v_line IS NULL THEN RAISE EXCEPTION 'No draft PR line'; END IF;
  IF v_old IS DISTINCT FROM (v_preview->'rows'->0->>'recommended_qty')::numeric THEN
    RAISE EXCEPTION 'Frozen PR quantity differs from the confirmed plan';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.proc_pr_ccf_generation_evidence
    WHERE pr_id=(v_out->>'pr_id')::bigint
      AND evidence->>'s5_plan_signature'=v_preview->>'plan_signature'
      AND evidence->>'source'='ind_operational_plan_plus_optional_history'
  ) THEN RAISE EXCEPTION 'Frozen evidence missing or wrong source'; END IF;

  PERFORM public.proc_pr_set_manual_delta(v_line,10,NULL);
  SELECT requested_qty+manual_delta_qty,manual_reason
   INTO v_new,v_reason FROM public.proc_pr_line WHERE pr_line_id=v_line;
  IF v_new<>v_old+10 OR v_reason NOT LIKE '%Manual quantity adjustment%'
   OR position(v_old::text in v_reason)=0 OR position(v_new::text in v_reason)=0
  THEN RAISE EXCEPTION 'Manual reason fallback failed: % %',v_new,v_reason; END IF;

  v_failed:=false;
  BEGIN
    PERFORM public.proc_pec_s5_generate_pr(
      'S5-ROLLBACK-TEST-DUP','2026-11-23','2026-11-01','2026-11-01',
      5,'normal','plan',false,'{}'::jsonb,'Disposable duplicate test',
      v_preview->>'plan_signature',true);
  EXCEPTION WHEN OTHERS THEN
    v_failed:=SQLERRM LIKE '%Existing active or draft PR%';
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Same-horizon duplicate PR was not rejected'; END IF;

  PERFORM set_config('request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000000',true);
  v_failed:=false;
  BEGIN
    PERFORM public.proc_pec_s5_review_plan(
      '2026-11-01','2026-11-01',5,'normal','plan',false);
  EXCEPTION WHEN OTHERS THEN
    v_failed:=SQLERRM LIKE '%Permission denied%'
       OR SQLERRM LIKE '%Not authenticated%';
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'No-access read was not rejected'; END IF;

  PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
  IF (SELECT count(*) FROM public.proc_pr_line
    WHERE pr_id=(v_out->>'pr_id')::bigint)<>1
  THEN RAISE EXCEPTION 'Unexpected draft PR line count'; END IF;
END $test$;
SELECT 'PASS' AS synthetic_role_and_writer_fixture;
-- Caller must issue ROLLBACK immediately after this script.
