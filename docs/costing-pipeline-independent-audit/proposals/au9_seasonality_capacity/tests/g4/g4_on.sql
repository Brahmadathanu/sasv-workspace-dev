\pset format unaligned
\pset tuples_only on
begin;
insert into costing.plant_aware_load_switch(is_enabled, effective_from, approval_reference, change_reason)
values (true, date '2026-11-01', 'LOCAL-TEST-ONLY', 'local test: simulated non-designated November run 9001');
\echo T2 switch ON, simulated November run 9001 (valuation 30 Nov 2026)
create temporary table t_on as select * from costing.local_g4_factors(date '2026-11-30');
select 'T2 rows='||count(*)||' changed='||count(*) filter (where abs(factor-legacy)>1e-9)||' md5='||md5(string_agg(allocation_pool||product_id||':'||round(factor,9),'|' order by allocation_pool,product_id)) from t_on;
\copy (select allocation_pool, product_id, factor, legacy from t_on order by 1,2) to '/workspace/au9/g4/g4_on_factors.csv' csv header
\echo T6 provenance capture for every step
select 'T6 captured='||costing.local_g4_capture(date '2026-11-30');
select 'T6 expected_steps='||count(*) from costing.local_step_evidence e join costing.route_load_scaling_snapshot s on s.refresh_run_id=128 and s.allocation_pool=e.allocation_pool and s.product_id=e.product_id;
select 'T6 rows='||count(*)||' missing_basis='||count(*) filter (where resolution_basis is null)
   ||' machine_or_rule_without_profile_or_revision='||count(*) filter (where resolution_basis in ('EXPLICIT_MACHINE','STEP_RULE_EQUIPMENT_CLASS') and (capacity_profile_id is null or capacity_revision_id is null))
   ||' fallback_without_policy='||count(*) filter (where resolution_basis not in ('EXPLICIT_MACHINE','STEP_RULE_EQUIPMENT_CLASS') and fallback_policy_id is null)
   ||' fallback_class_lot_without_legacy_row='||count(*) filter (where fallback_policy_id is not null and legacy_capacity_id is null and charge_basis<>'SINGLE_LOAD')
   ||' switch_ids='||count(distinct switch_id) from costing.route_step_load_provenance_snapshot where refresh_run_id=9001;
select 'T6 factor_from_provenance_mismatch='||count(*) from (
  select t.allocation_pool, t.product_id, t.factor, sum(e.step_factor*p.loads) pf
    from t_on t join costing.local_step_evidence e on e.allocation_pool=t.allocation_pool and e.product_id=t.product_id
    join costing.route_step_load_provenance_snapshot p on p.refresh_run_id=9001 and p.allocation_pool=e.allocation_pool and p.product_id=e.product_id and p.effective_step_key=e.effective_step_key
   group by 1,2,3) z where abs(factor-pf)>1e-9;
select 'T6 labour_vs_overhead_same_step_differs='||count(*) from costing.route_step_load_provenance_snapshot d
  join costing.route_step_load_provenance_snapshot p on p.refresh_run_id=d.refresh_run_id and p.product_id=d.product_id and p.effective_step_key=d.effective_step_key
 where d.refresh_run_id=9001 and d.allocation_pool='MANUFACTURING_LABOUR' and p.allocation_pool='PRODUCTION_OVERHEAD' and (d.loads<>p.loads or d.resolution_basis<>p.resolution_basis);
\echo T6 provenance by basis (overhead pool; GRINDER steps detailed)
select 'T6 '||allocation_pool||' '||resolution_basis||' '||coalesce(equipment_class_code,'-')||' cap='||coalesce(capacity::text,'-')||coalesce(capacity_unit,'')||' steps='||count(*)
  from costing.route_step_load_provenance_snapshot where refresh_run_id=9001 and resource_class_code='GRINDER' group by allocation_pool, resolution_basis, equipment_class_code, capacity, capacity_unit order by 1;
select 'T6 non-grinder '||allocation_pool||' '||resolution_basis||' steps='||count(*)||' flags='||coalesce(string_agg(distinct f,','),'-')
  from costing.route_step_load_provenance_snapshot left join lateral unnest(review_flags) f on true
 where refresh_run_id=9001 and resource_class_code<>'GRINDER' group by allocation_pool, resolution_basis order by 1;
\copy (select * from costing.route_step_load_provenance_snapshot where refresh_run_id=9001 order by allocation_pool, product_id, sequence_no) to '/workspace/au9/g4/g4_provenance_run9001.csv' csv header
\echo T3 pool absorption (allocation = pool x workload share; workload scales with the route factor)
with f as (select * from t_on),
w as (select w.allocation_pool, w.product_id, w.workload_units * coalesce(f.factor/nullif(f.legacy,0),1) wl_new, w.workload_units wl_old
        from costing.local_product_workload w left join f on f.allocation_pool=w.allocation_pool and f.product_id=w.product_id where w.workload_units>0),
a as (select w.allocation_pool, p.pool_amount, w.product_id,
             p.pool_amount*w.wl_new/sum(w.wl_new) over (partition by w.allocation_pool) alloc_new, p.pool_amount*w.wl_old/sum(w.wl_old) over (partition by w.allocation_pool) alloc_old
        from w join costing.local_pool p on p.allocation_pool=w.allocation_pool)
select 'T3 '||allocation_pool||' pool='||round(max(pool_amount),2)||' absorbed_ON='||round(sum(alloc_new),6)||' absorbed_OFF='||round(sum(alloc_old),6)
       ||' unabsorbed_ON='||round(max(pool_amount)-sum(alloc_new),9)||' products='||count(*)||' moved='||count(*) filter (where abs(alloc_new-alloc_old)>0.005)
  from a group by allocation_pool order by 1;
\echo T4 with the switch ON, October valuation dates are untouched and rejected
select 'T4 oct16 wrapper rows='||count(*)||' mismatches='||count(*) filter (where abs(factor-legacy)>1e-9) from costing.local_g4_factors(date '2026-10-16');
select 'T4 oct31 wrapper rows='||count(*)||' mismatches='||count(*) filter (where abs(factor-legacy)>1e-9) from costing.local_g4_factors(date '2026-10-31');
select 'T4 load_mode oct31='||coalesce(costing.fn_au9_g4_load_mode(date '2026-10-31')::text,'OFF')||' nov01='||coalesce(costing.fn_au9_g4_load_mode(date '2026-11-01')::text,'OFF');
select 'T4 capture for Oct date returns='||costing.fn_au9_g4_capture_provenance(128, date '2026-10-01', date '2026-10-16', 'PRODUCTION_OVERHEAD', 1, 100, 100, 'L', '[{"resource_class_code":"GRINDER"}]');
rollback;
