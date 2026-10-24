-- CI-037 read-only verification. Run BEFORE and AFTER apply; results must match where stated.
-- 1. Fingerprints of approved/designated runs unchanged (expected: 0 rows with matches=false)
select r.run, f.table_name, f.matches
from unnest(array[128,136,140,143]::bigint[]) r(run), lateral costing.fn_verify_run_fingerprint(r.run) f
where not f.matches;
-- 2. Legacy margin values unchanged (record before; md5 must be identical after)
select refresh_run_id, count(*),
       md5(string_agg(concat_ws('|',sku_id,ik_margin_amount_before_scheme,ok_margin_amount_before_scheme,ik_margin_percent_before_scheme,ok_margin_percent_before_scheme),',' order by sku_id)) legacy_md5
from costing.sku_pricing_bridge_snapshot where refresh_run_id in (128,136,140,143) group by 1 order by 1;
-- 3. Legacy comments set (expected: 'Legacy MRP-based cost difference — not profit' x2)
select a.attname, col_description(a.attrelid,a.attnum) from pg_attribute a
where a.attrelid='costing.sku_pricing_bridge_snapshot'::regclass and a.attname like '%margin_amount_before_scheme';
-- 4. New columns nullable and NULL for designated runs (expected: all is_nullable=YES; filled=0)
select column_name, is_nullable from information_schema.columns
where table_schema='costing' and table_name='sku_pricing_bridge_snapshot' and (column_name like '%estimated_profit%' or column_name like '%realization%' or column_name like '%profit_calculation%' or column_name like '%scheme_%qty' or column_name like '%scheme_effective%');
select count(*) filter (where ik_profit_calculation_status is not null or ok_profit_calculation_status is not null) filled
from costing.sku_pricing_bridge_snapshot where refresh_run_id in (128,136,140,143);
-- 5. Approved master still 627 rows on run 143, new columns NULL, ACL still postgres-only
select refresh_run_id, count(*), count(ik_estimated_profit_per_sku) new_filled from costing.v_price_revision_current_approved_master group by 1;
select relacl from pg_class where oid='costing.v_price_revision_current_approved_master'::regclass;
-- 6. Chain hook present exactly once, after the selected-scheme step (expected: true)
select pg_get_functiondef('costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint)'::regprocedure)
  ~ 'rpc_refresh_sku_selected_scheme_policy_context_snapshot\([^)]*\);\s*perform costing\.fn_ci037_fill_pricing_bridge_profit';
-- 7. Helper refuses a designated run (expected: error 'run 143 is designated'; run inside a rolled-back transaction)
-- begin; select costing.fn_ci037_fill_pricing_bridge_profit(143); rollback;
-- 8. First future run (Nov trial, separately approved): CALCULATED count, status mix, and reconcile 975 IK ≈ -8,111.95 basis.
