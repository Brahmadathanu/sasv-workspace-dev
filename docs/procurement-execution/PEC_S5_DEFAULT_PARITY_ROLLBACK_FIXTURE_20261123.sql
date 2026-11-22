-- PEC S5 exact-default-parity fixture (read-only synthetic authorisation).
-- Load source candidates A+C in BEGIN; run this and ROLLBACK.
DO $test$
DECLARE v_user uuid;v_old jsonb;v_new jsonb;v_count integer;
BEGIN
 SELECT user_id INTO v_user FROM public.user_permissions_canonical
 WHERE target='module:procurement-execution-console' AND can_view AND can_edit LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',v_user::text,true);

 SELECT coalesce(jsonb_agg(x ORDER BY (x->>'stock_item_id')::bigint,
   (x->>'uom_id')::bigint),'[]'::jsonb) INTO v_old
 FROM public.proc_pec_s4_new_pr_plan('2026-11-01','2026-12-01',1,'normal') x;
 SELECT coalesce(jsonb_agg(
   x-'method'-'planning_method'-'history_comparison'-'source'-'material_scope'
   ORDER BY (x->>'stock_item_id')::bigint,(x->>'uom_id')::bigint),'[]'::jsonb)
 INTO v_new FROM public.proc_pec_s5_unified_plan(
  '2026-11-01','2026-12-01',1,'normal','hybrid',true) x;
 IF v_old<>v_new THEN RAISE EXCEPTION 'S5 RM normal hybrid differs from S4 baseline'; END IF;

 SELECT coalesce(jsonb_agg(x ORDER BY (x->>'stock_item_id')::bigint,
   (x->>'uom_id')::bigint),'[]'::jsonb) INTO v_old
 FROM public.proc_pec_s4_new_pr_plan('2026-11-01','2026-12-01',2,'normal') x;
 SELECT coalesce(jsonb_agg(
   x-'method'-'planning_method'-'history_comparison'-'source'-'material_scope'
   ORDER BY (x->>'stock_item_id')::bigint,(x->>'uom_id')::bigint),'[]'::jsonb)
 INTO v_new FROM public.proc_pec_s5_unified_plan(
  '2026-11-01','2026-12-01',2,'normal','hybrid',true) x;
 IF v_old<>v_new THEN RAISE EXCEPTION 'S5 PM hybrid differs from S4 baseline'; END IF;

 SELECT coalesce(jsonb_agg(x ORDER BY (x->>'stock_item_id')::bigint,
   (x->>'uom_id')::bigint),'[]'::jsonb) INTO v_old
 FROM public.proc_pec_jit_mrp_plan('2026-11-01','2026-12-01',true) x;
 SELECT coalesce(jsonb_agg(
   x-'method'-'planning_method'-'history_comparison'-'source'-'material_scope'
   ORDER BY (x->>'stock_item_id')::bigint,(x->>'uom_id')::bigint),'[]'::jsonb)
 INTO v_new FROM public.proc_pec_s5_unified_plan(
  '2026-11-01','2026-12-01',1,'jit','plan',true) x;
 IF v_old<>v_new THEN RAISE EXCEPTION 'S5 JIT plan-only differs from v6.3.3 route'; END IF;

 SELECT count(*) INTO v_count
 FROM (
   SELECT x->>'stock_item_id' item,x->>'uom_id' uom
   FROM public.proc_pec_s5_unified_plan(
     '2026-11-01','2026-12-01',1,'all','hybrid',true) x
   GROUP BY 1,2 HAVING count(*)>1
 ) d;
 IF v_count<>0 THEN RAISE EXCEPTION 'RM ALL yielded duplicate item/UOM lines'; END IF;
END $test$;
SELECT 'PASS' AS rm_pm_jit_default_parity_and_rm_all_uniqueness;
