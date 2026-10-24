set -u
Q="psql -h /tmp -p 54337 -U postgres -d t -X -q -v ON_ERROR_STOP=1"
q(){ echo "== $1"; shift; $Q "$@" 2>&1 | sed 's/^/   /'; }
FP="select md5(string_agg(run||f.table_name||coalesce(f.current_value->>'md5',''),'|' order by run,f.table_name)) agg, bool_and(matches) all_match from unnest(array[1,2]) run, lateral costing.fn_verify_run_fingerprint(run) f"
q "T0 baseline fingerprints (run1 legacy capture w/o cols, run2 with cols)" -tAc "$FP"
q "T1 v1-design check: ADD COLUMN on pricing bridge inside rolled-back txn -> legacy capture drifts?" -tA <<'S'
begin; alter table costing.sku_pricing_bridge_snapshot add column zz numeric;
select run, bool_and(matches) from unnest(array[1,2]) run, lateral costing.fn_verify_run_fingerprint(run) f group by 1 order by 1; rollback;
S
q "T2 apply fix" -f /workspace/sasv/docs/costing-pipeline-independent-audit/closure/prepared/CI-037_profit_fix.sql
q "T3 fingerprints after fix (must equal T0)" -tAc "$FP"
q "T4 view cols / owner / privs after fix" -tAc "select count(*) from pg_attribute where attrelid='costing.v_price_revision_current_approved_master'::regclass and attnum>0; select pg_get_userbyid(relowner), relacl, reloptions from pg_class where oid='costing.v_price_revision_current_approved_master'::regclass; select r, has_table_privilege(r,'costing.v_price_revision_current_approved_master','SELECT') from unnest(array['anon','authenticated','service_role','postgres']) r"
q "T5 hook block re-run (idempotent)" -f hook.sql
q "T6 hook count" -tAc "select (length(d)-length(replace(d,'perform costing.fn_ci037_fill_pricing_bridge_profit(p_refresh_run_id);','')))/70 from (select pg_get_functiondef('costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint)'::regprocedure) d) x"
q "T7 duplicated hook -> must error" <<'S'
begin;
do $$ declare d text := pg_get_functiondef('costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint)'::regprocedure); begin execute replace(d,'select * into v_result','perform costing.fn_ci037_fill_pricing_bridge_profit(p_refresh_run_id);'||chr(10)||'        select * into v_result'); end $$;
\i hook.sql
rollback;
S
q "T8 misplaced hook -> must error" <<'S'
begin;
do $$ declare d text := pg_get_functiondef('costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint)'::regprocedure); begin
 d := replace(d, chr(10)||'        perform costing.fn_ci037_fill_pricing_bridge_profit(p_refresh_run_id);','');
 execute replace(d,'return query select v_result','perform costing.fn_ci037_fill_pricing_bridge_profit(p_refresh_run_id);'||chr(10)||'        return query select v_result'); end $$;
\i hook.sql
rollback;
S
q "T9 helper on APPROVED run 1 -> must refuse" -tAc "select costing.fn_ci037_fill_pricing_bridge_profit(1)"
q "T10 direct insert into profit table for designated run -> guard must block" -tAc "insert into costing.sku_pricing_bridge_profit_snapshot(period_start,valuation_date,refresh_run_id,pricing_bridge_snapshot_id,sku_id,region_code,profit_calculation_status,profit_calculation_basis) select period_start,'2026-10-22',1,id,sku_id,'IK','X','X' from costing.sku_pricing_bridge_snapshot where refresh_run_id=1 limit 1"
q "T11 helper on undesignated run 3" -tAc "select costing.fn_ci037_fill_pricing_bridge_profit(3); select sku_id, region_code, scheme_paid_qty||'+'||scheme_free_qty, round(scheme_effective_selling_price,2), round(net_sales_realization_per_sku,2), round(estimated_profit_per_sku,2), profit_calculation_status from costing.sku_pricing_bridge_profit_snapshot where refresh_run_id=3 order by 1,2"
q "T12 rerun helper (idempotent, same count)" -tAc "select costing.fn_ci037_fill_pricing_bridge_profit(3), count(*) from costing.sku_pricing_bridge_profit_snapshot where refresh_run_id=3"
q "T13 invalid inputs -> explicit codes, never CALCULATED (rolled back)" -tA <<'S'
begin;
update costing.sku_selling_price_bridge_snapshot set gst_percent=null where refresh_run_id=3 and sku_id=975;
update costing.sku_selling_price_bridge_snapshot set ik_contingency_value=ik_basic_price*0.02 where refresh_run_id=3 and sku_id=45;
update costing.sku_pricing_bridge_snapshot set pricing_bridge_status_ok='BLOCKED' where refresh_run_id=3 and sku_id=51;
update costing.sku_pricing_bridge_snapshot set mrp_ik=0 where refresh_run_id=3 and sku_id=51;
update costing.sku_selected_scheme_policy_context_snapshot set paid_qty=0 where refresh_run_id=3 and sku_id=45 and region_code='OK';
select costing.fn_ci037_fill_pricing_bridge_profit(3);
select sku_id, region_code, profit_calculation_status, estimated_profit_per_sku is null from costing.sku_pricing_bridge_profit_snapshot where refresh_run_id=3 order by 1,2;
rollback;
S
q "T14 missing OK scheme row -> must raise, nothing written (rolled back)" -tA <<'S'
begin;
delete from costing.sku_selected_scheme_policy_context_snapshot where refresh_run_id=3 and sku_id=45 and region_code='OK';
select costing.fn_ci037_fill_pricing_bridge_profit(3);
rollback;
S
q "T15 duplicate pricing-bridge SKU -> must raise (rolled back)" -tA <<'S'
begin;
create temp table x as select * from costing.sku_pricing_bridge_snapshot where refresh_run_id=3 and sku_id=975; alter table x drop column id; insert into costing.sku_pricing_bridge_snapshot select nextval(pg_get_serial_sequence('costing.sku_pricing_bridge_snapshot','id')), x.* from x;
select costing.fn_ci037_fill_pricing_bridge_profit(3);
rollback;
S
q "T16 verify script runs (errors only expected where live-only tables absent)" -tA -v ON_ERROR_STOP=0 -f /workspace/sasv/docs/costing-pipeline-independent-audit/closure/prepared/CI-037_verify.sql
q "T17 rollback A with data present -> must refuse" -f /workspace/sasv/docs/costing-pipeline-independent-audit/closure/prepared/CI-037_rollback_A_structural.sql
q "T18 rollback B (unhook, keep data)" -f /workspace/sasv/docs/costing-pipeline-independent-audit/closure/prepared/CI-037_rollback_B_post_use.sql
q "T19 after B: hooks / rows kept / view cols" -tAc "select position('fn_ci037_fill' in pg_get_functiondef('costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint)'::regprocedure)); select count(*) from costing.sku_pricing_bridge_profit_snapshot; select count(*) from pg_attribute where attrelid='costing.v_price_revision_current_approved_master'::regclass and attnum>0"
q "T20 rollback B again (idempotent)" -f /workspace/sasv/docs/costing-pipeline-independent-audit/closure/prepared/CI-037_rollback_B_post_use.sql
q "T21 clear test data, then rollback A" -tAc "delete from costing.sku_pricing_bridge_profit_snapshot where refresh_run_id=3"
q "T21b rollback A" -f /workspace/sasv/docs/costing-pipeline-independent-audit/closure/prepared/CI-037_rollback_A_structural.sql
q "T22 after A: view cols / owner+acl+reloptions / privs / comment count / table gone / chain = pre / view = pre" -tA -v chain="$(cat chain_pre.txt)" -v view="$(cat view_pre.txt)" <<'S'
select count(*) from pg_attribute where attrelid='costing.v_price_revision_current_approved_master'::regclass and attnum>0;
select pg_get_userbyid(relowner), relacl, reloptions from pg_class where oid='costing.v_price_revision_current_approved_master'::regclass;
select string_agg(r||'='||has_table_privilege(r,'costing.v_price_revision_current_approved_master','SELECT'),',') from unnest(array['anon','authenticated','service_role','postgres']) r;
select count(*) from pg_attribute where attrelid='costing.v_price_revision_current_approved_master'::regclass and col_description(attrelid,attnum) is not null;
select to_regclass('costing.sku_pricing_bridge_profit_snapshot') is null table_dropped;
select rtrim(pg_get_functiondef('costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint)'::regprocedure),E'\n') = rtrim(:'chain',E'\n') chain_identical;
select pg_get_viewdef('costing.v_price_revision_current_approved_master'::regclass,true) = :'view' view_identical;
S
q "T23 fingerprints after full cycle (must equal T0)" -tAc "$FP"
q "T24 fix re-applies cleanly after rollback A" -f /workspace/sasv/docs/costing-pipeline-independent-audit/closure/prepared/CI-037_profit_fix.sql
