-- CI-037 read-only verification. Run BEFORE and AFTER apply (and after either rollback). SELECT only.
-- Baseline captured read-only 24 Oct 2026 ~21:45 IST (see CI-037_snapshot_view_metadata_pre.json).

-- 1. Fingerprint drift, every designated run (119 REFERENCE, 122/143 APPROVED, 128/136/140 REVOKED).
--    Expected BEFORE and AFTER: exactly one row = the pre-existing mismatch (119, sku_sales_allocation_basis_snapshot).
select r.run, f.table_name, f.matches
from (select refresh_run_id run from costing.v_costing_run_effective_designation) r,
     lateral costing.fn_verify_run_fingerprint(r.run) f
where not f.matches order by 1,2;

-- 2. Zero drift: aggregate of all current table hashes for runs 119/122/128/136/140/143.
--    Expected: e24fdba6178844b29b5360b8e258e929 (identical before and after).
select md5(string_agg(r.run||':'||f.table_name||':'||coalesce(f.current_value->>'md5','')||':'||coalesce(f.current_value->>'rows',''),'|' order by r.run,f.table_name)) agg,
       md5(string_agg(r.run||':'||f.table_name||':'||coalesce(f.current_value->>'md5','')||':'||coalesce(f.current_value->>'rows',''),'|' order by r.run,f.table_name)) = 'e24fdba6178844b29b5360b8e258e929' as zero_drift
from unnest(array[119,122,128,136,140,143]::bigint[]) r(run), lateral costing.fn_verify_run_fingerprint(r.run) f;

-- 3. Legacy margin values unchanged (expected: all ok=true).
select b.run, b.n, x.n now_n, x.legacy_md5 = b.md5 and x.n = b.n::bigint ok
from (values ('119','635','0dc018baf0608a2641f8b7f32ba92061'),('122','634','73ff42395fbe847648d2602c55a8d445'),('128','627','c678794ce52f3775b1ce6514352e47e4'),('136','627','69212699fde6488605314db8f7227272'),('140','627','a87870b950e2b97e8811dc51f02a154e'),('143','627','847226bb71b78b468cf31efc0a6b64d2')) b(run,n,md5)
left join (select refresh_run_id::text run, count(*) n,
  md5(string_agg(concat_ws('|',sku_id,ik_margin_amount_before_scheme,ok_margin_amount_before_scheme,ik_margin_percent_before_scheme,ok_margin_percent_before_scheme),',' order by sku_id)) legacy_md5
  from costing.sku_pricing_bridge_snapshot where refresh_run_id in (119,122,128,136,140,143) group by 1) x on x.run = b.run order by 1;

-- 4. sku_pricing_bridge_snapshot structure unchanged (expected: 48 columns).
select count(*) from pg_attribute where attrelid='costing.sku_pricing_bridge_snapshot'::regclass and attnum>0 and not attisdropped;

-- 5. Immutability guard (cites costing.fn_guard_designated_run_rows: raises AU2_DESIGNATED_RUN_IMMUTABLE for
--    REFERENCE/APPROVED/REVOKED on INSERT/UPDATE/DELETE). Expected AFTER: both tables listed, enabled 'O'.
select tgrelid::regclass, tgname, tgenabled, pg_get_triggerdef(oid) like '%fn_guard_designated_run_rows%' uses_guard
from pg_trigger where tgname in ('trg_au2_designated_run_guard','trg_au2_snapshot_truncate_guard')
  and tgrelid in ('costing.sku_pricing_bridge_snapshot'::regclass, coalesce(to_regclass('costing.sku_pricing_bridge_profit_snapshot'),'costing.sku_pricing_bridge_snapshot'::regclass)) order by 1,2;

-- 6. No CI-037 rows for any designated run (expected: 0).
select count(*) from costing.sku_pricing_bridge_profit_snapshot p join costing.v_costing_run_effective_designation e using (refresh_run_id);

-- 7. Approved master: 627 rows on run 143, 64 legacy + 15 new columns (79 AFTER, 64 BEFORE / after rollback A),
--    new columns NULL for run 143; owner postgres; reloptions NULL; privileges unchanged.
select refresh_run_id, count(*) from costing.v_price_revision_current_approved_master group by 1;
select count(*) ncols from pg_attribute where attrelid='costing.v_price_revision_current_approved_master'::regclass and attnum>0 and not attisdropped;
select pg_get_userbyid(relowner) owner, relacl, reloptions from pg_class where oid='costing.v_price_revision_current_approved_master'::regclass;
select r, has_table_privilege(r,'costing.v_price_revision_current_approved_master','SELECT') sel
from unnest(array['anon','authenticated','service_role','postgres']) r;  -- expected f,f,f,t

-- 8. Hook: expected AFTER fix exactly 1 and correctly positioned; after either rollback 0.
select (length(d)-length(replace(d,'perform costing.fn_ci037_fill_pricing_bridge_profit(p_refresh_run_id);','')))/length('perform costing.fn_ci037_fill_pricing_bridge_profit(p_refresh_run_id);') hooks,
       d ~ 'rpc_refresh_sku_selected_scheme_policy_context_snapshot\(v_period_start,p_valuation_date,p_refresh_run_id\);\s*perform costing\.fn_ci037_fill_pricing_bridge_profit\(p_refresh_run_id\);' positioned
from (select pg_get_functiondef('costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint)'::regprocedure) d) x;

-- 9. Legacy comments (expected AFTER: 'Legacy MRP-based cost difference — not profit' on the amount columns).
select attname, col_description(attrelid,attnum) from pg_attribute
where attrelid='costing.sku_pricing_bridge_snapshot'::regclass and attname like '%margin_%before_scheme' order by 1;

-- 10. First future run only (separately approved): status mix and completeness.
-- select profit_calculation_status, region_code, count(*) from costing.sku_pricing_bridge_profit_snapshot where refresh_run_id = <new run> group by 1,2;
