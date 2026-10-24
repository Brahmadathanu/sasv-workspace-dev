\set ON_ERROR_STOP 1
update costing.costing_refresh_run set overall_status='RUNNING', current_stage_code='03_COST_BUILD_TO_SCHEME';
\i live_qc_alloc.sql
select 'T0 old fn call' t, * from costing.rpc_refresh_qc_monetary_allocation_snapshot('2026-10-01','2026-10-16',126);
create table costing.old_qca as select * from costing.product_qc_allocation_snapshot;
create table costing.old_sqa as select * from costing.sku_qc_allocation_snapshot;
select 'T0 old==live' t, (select max(abs(a.qc_cost_per_product_base_uom-l.qc_cost_per_product_base_uom)) from costing.old_qca a join costing.live_qca l using(product_id)) prod_maxdiff,
  (select max(abs(a.quality_control_overhead_cost_per_sku-l.quality_control_overhead_cost_per_sku)) from costing.old_sqa a join costing.live_sqa l using(sku_id)) sku_maxdiff,
  (select count(*) from costing.old_sqa) n_sku;
create or replace function pg_temp.fp(t text) returns text language plpgsql as $$ declare r text; begin
 if t='p' then select md5(string_agg(md5((to_jsonb(x)-'id'-'refreshed_at'-'product_workload_snapshot_id')::text),'' order by product_id)) into r from costing.product_qc_allocation_snapshot x;
 else select md5(string_agg(md5((to_jsonb(x)-'id'-'refreshed_at'-'product_qc_allocation_snapshot_id')::text),'' order by sku_id)) into r from costing.sku_qc_allocation_snapshot x; end if; return r; end $$;
create table costing.fp_old as select pg_temp.fp('p') p, pg_temp.fp('s') s;
update costing.costing_refresh_run set overall_status='SUCCESS';
\i prepared.sql
select 'T-1 prepared guard: switch seeded' t, is_enabled, effective_from from costing.qc_batch_true_switch;
delete from costing.qc_batch_true_switch;
update costing.costing_refresh_run set overall_status='RUNNING';
-- T1 switch row absent
select 'T1 no switch' t, (select count(*) from costing.rpc_refresh_qc_monetary_allocation_snapshot('2026-10-01','2026-10-16',126)) c, pg_temp.fp('p')=(select p from costing.fp_old) p_same, pg_temp.fp('s')=(select s from costing.fp_old) s_same, (select count(*) from costing.batch_true_absorption_variance) var_rows;
insert into costing.qc_batch_true_switch(id,is_enabled,effective_from,note) values (true,false,'2026-10-01','test');
select 'T2 switch OFF' t, (select count(*) from costing.rpc_refresh_qc_monetary_allocation_snapshot('2026-10-01','2026-10-16',126)) c, pg_temp.fp('p')=(select p from costing.fp_old) p_same, pg_temp.fp('s')=(select s from costing.fp_old) s_same;
update costing.qc_batch_true_switch set is_enabled=true, effective_from='2026-11-01';
select 'T3 ON but valuation<effective_from (Sep-equivalent)' t, (select count(*) from costing.rpc_refresh_qc_monetary_allocation_snapshot('2026-10-01','2026-10-16',126)) c, pg_temp.fp('p')=(select p from costing.fp_old) p_same, pg_temp.fp('s')=(select s from costing.fp_old) s_same, (select count(*) from costing.batch_true_absorption_variance) var_rows;
update costing.qc_batch_true_switch set effective_from='2026-10-01';
select 'T4 ON' t, r.* from costing.rpc_refresh_qc_monetary_allocation_snapshot('2026-10-01','2026-10-16',126) r;
select 'T4 variance' t, pool_amount, absorbed_at_standard, variance_amount, products_batch_true, products_current_method, round(rate_used,6) rate from costing.batch_true_absorption_variance;
select 'T4 keys' t, s.sku_id, round(o.quality_control_overhead_cost_per_sku,2) old_qc, round(s.quality_control_overhead_cost_per_sku,2) new_qc, s.allocation_status, o.allocation_status old_status from costing.sku_qc_allocation_snapshot s join costing.old_sqa o using(sku_id) where s.sku_id in (1792,937,1769,1770,879,988,1797) order by 2;
select 'T4 status unchanged' t, count(*) filter (where s.allocation_status<>o.allocation_status or s.allocation_reason_code<>o.allocation_reason_code) changed from costing.sku_qc_allocation_snapshot s join costing.old_sqa o using(sku_id);
select 'T4 sum share' t, round(sum(product_workload_share),12) s, round(sum(product_qc_allocation_amount),6) amt from costing.product_qc_allocation_snapshot;
select 'T4 note' t, left(allocation_note,200) from costing.product_qc_allocation_snapshot where product_id=54;
create table costing.fp_new as select pg_temp.fp('p') p, pg_temp.fp('s') s;
-- T5 idempotent: call twice in one transaction
begin;
select count(*) from costing.rpc_refresh_qc_monetary_allocation_snapshot('2026-10-01','2026-10-16',126);
select 'T5 twice in txn' t, (select count(*) from costing.rpc_refresh_qc_monetary_allocation_snapshot('2026-10-01','2026-10-16',126)) c, pg_temp.fp('p')=(select p from costing.fp_new) p_same, pg_temp.fp('s')=(select s from costing.fp_new) s_same;
commit;
-- T6 fallback: product 54 without batch size -> current method for 54, full absorption
begin;
update costing.product_production_overhead_workload_snapshot set preferred_batch_size=null where product_id=54;
select 'T6 call' t, r.pool_difference from costing.rpc_refresh_qc_monetary_allocation_snapshot('2026-10-01','2026-10-16',126) r;
select 'T6 fallback' t, (select products_current_method from costing.batch_true_absorption_variance) cur,
  (select round(p.product_qc_allocation_amount,6)=round(o.product_qc_allocation_amount,6) from costing.product_qc_allocation_snapshot p join costing.old_qca o using(product_id) where product_id=54) p54_old_amt,
  (select round(p.qc_cost_per_product_base_uom,2) from costing.product_qc_allocation_snapshot p where product_id=54) p54_rate,
  (select round(variance_amount,9) from costing.batch_true_absorption_variance) var, (select round(sum(product_qc_allocation_amount),6) from costing.product_qc_allocation_snapshot) absorbed;
rollback;
-- T7 terminal run guard
\set ON_ERROR_STOP 0
begin; update costing.costing_refresh_run set overall_status='SUCCESS';
select 'T7 SUCCESS run' t, * from costing.rpc_refresh_qc_monetary_allocation_snapshot('2026-10-01','2026-10-16',126);
rollback;
begin; insert into costing.run_designation_fixture values (126,'APPROVED');
select 'T8 APPROVED run' t, * from costing.rpc_refresh_qc_monetary_allocation_snapshot('2026-10-01','2026-10-16',126);
rollback;
truncate costing.sku_qc_allocation_snapshot;
\set ON_ERROR_STOP 1
select 'T9 rows intact after guarded failures' t, count(*), pg_temp.fp('s')=(select s from costing.fp_new) same from costing.sku_qc_allocation_snapshot;
