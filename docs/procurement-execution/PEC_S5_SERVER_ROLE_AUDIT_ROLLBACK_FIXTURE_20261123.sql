-- PEC S5 supplemental role, plan audit and stale-edit rollback checks.
-- Load candidates A+B+C+D inside BEGIN; execute this; ROLLBACK.
DO $test$
DECLARE v_editor uuid;v_viewer uuid;v_first jsonb;v_second jsonb;
        v_count int;v_failed boolean;v_id bigint;
BEGIN
 SELECT user_id INTO v_editor FROM public.user_permissions_canonical
 WHERE target='module:procurement-execution-console' AND can_view AND can_edit LIMIT 1;
 SELECT user_id INTO v_viewer FROM public.user_permissions_canonical
 WHERE target='module:procurement-execution-console' AND can_view AND NOT can_edit LIMIT 1;
 IF v_editor IS NULL OR v_viewer IS NULL THEN
   RAISE EXCEPTION 'Cannot run role fixture: distinct editor and view-only claims required';
 END IF;
 PERFORM set_config('request.jwt.claim.sub',v_editor::text,true);
 v_first:=public.proc_pec_ind_set_planned_requirement(
   2654,'2026-11-01',1000,'Initial approved disposable requirement',true);
 v_id:=(v_first->>'id')::bigint;
 v_first:=public.proc_pec_s5_review_plan(
   '2026-11-01','2026-11-01',5,'normal','plan',false);

 PERFORM public.proc_pec_ind_set_planned_requirement(
   2654,'2026-11-01',1100,'Changed quantity for disposable test',true);
 v_second:=public.proc_pec_s5_review_plan(
   '2026-11-01','2026-11-01',5,'normal','plan',false);
 IF v_first->>'plan_signature'=v_second->>'plan_signature' THEN
   RAISE EXCEPTION 'IND plan edit did not invalidate review';
 END IF;
 SELECT count(*) INTO v_count FROM public.proc_pec_ind_planned_requirement_audit
 WHERE plan_id=v_id;
 IF v_count<>2 THEN RAISE EXCEPTION 'IND before/after audit missing: %',v_count; END IF;
 IF (SELECT count(*) FROM public.proc_pec_ind_list_planned_requirements(
   '2026-11-01','2026-11-01') x WHERE (x->>'stock_item_id')::bigint=2654
   AND (x->>'planned_qty')::numeric=1100)<>1
 THEN RAISE EXCEPTION 'Governed monthly plan listing mismatch'; END IF;

 -- One real canonical View-only claim, synthetically injected in rollback.
 PERFORM set_config('request.jwt.claim.sub',v_viewer::text,true);
 PERFORM public.proc_pec_s5_review_plan(
   '2026-11-01','2026-11-01',5,'normal','plan',false);
 PERFORM 1 FROM public.proc_pec_ind_list_planned_requirements(
   '2026-11-01','2026-11-01') LIMIT 1;

 v_failed:=false;
 BEGIN
  PERFORM public.proc_pec_ind_set_planned_requirement(
    2654,'2026-11-01',1200,'View-only must be denied this update',true);
 EXCEPTION WHEN OTHERS THEN
  v_failed:=SQLERRM LIKE '%Permission denied%';
 END;
 IF NOT v_failed THEN RAISE EXCEPTION 'View-only IND plan writer was not denied'; END IF;

 v_failed:=false;
 BEGIN
  PERFORM public.proc_pec_s5_generate_pr(
    'S5-VIEW-ONLY-REJECT','2026-11-23','2026-11-01','2026-11-01',
    5,'normal','plan',false,'{}'::jsonb,'Viewer negative test',
    v_second->>'plan_signature',true);
 EXCEPTION WHEN OTHERS THEN
  v_failed:=SQLERRM LIKE '%Permission denied%';
 END;
 IF NOT v_failed THEN RAISE EXCEPTION 'View-only S5 PR writer was not denied'; END IF;

 IF (SELECT gross_required_qty FROM public.proc_pec_ind_planned_requirement
   WHERE id=v_id)<>1100 THEN RAISE EXCEPTION 'Denied edit changed plan'; END IF;
 IF EXISTS(SELECT 1 FROM public.proc_pr_header WHERE pr_number='S5-VIEW-ONLY-REJECT')
 THEN RAISE EXCEPTION 'Denied PR generation created a header'; END IF;
END $test$;
SELECT 'PASS' AS role_audit_stale_plan_fixture;
