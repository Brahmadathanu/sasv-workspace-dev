set -e
P="sudo -u postgres psql -q -d au5_local -v ON_ERROR_STOP=1"
sudo -u postgres psql -qc "drop database if exists au5_local" -c "create database au5_local" 2>/dev/null
$P -f fixture.sql -f au5_batch_true.sql >/dev/null 2>&1
$P -At -c "select 'off:'||costing.fn_apply_batch_true_standard(122)" -c "select 'unchanged:'||(select count(*) from costing.sku_production_overhead_allocation_snapshot a join costing.before_poh b using(sku_id) where a.production_overhead_cost_per_sku is distinct from b.production_overhead_cost_per_sku)"
for mode in APPROVED_RATE NORMAL_VOLUME_RATE; do
$P -c "update costing.sku_production_overhead_allocation_snapshot a set production_overhead_cost_per_sku=b.production_overhead_cost_per_sku from costing.before_poh b where a.sku_id=b.sku_id; update costing.sku_direct_labour_allocation_snapshot a set manufacturing_direct_labour_cost_per_sku=b.manufacturing_direct_labour_cost_per_sku, direct_labour_cost_per_sku=b.direct_labour_cost_per_sku from costing.before_dl b where a.sku_id=b.sku_id; update costing.batch_true_standard_switch set is_enabled=true, rate_basis='$mode'"
$P -At -F'|' -c "select '$mode', costing.fn_apply_batch_true_standard(122)" -c "select allocation_pool, round(pool_amount), round(absorbed_at_standard), round(variance_amount) from costing.batch_true_absorption_variance" \
 -c "select 'sku', a.sku_id, round(bp.production_overhead_cost_per_sku+bd.manufacturing_direct_labour_cost_per_sku,2) before_conv, round(a.production_overhead_cost_per_sku+d.manufacturing_direct_labour_cost_per_sku,2) after_conv from costing.sku_production_overhead_allocation_snapshot a join costing.before_poh bp using(sku_id) join costing.sku_direct_labour_allocation_snapshot d using(sku_id) join costing.before_dl bd using(sku_id) where a.sku_id in (879,988) order by 2" \
 -c "\copy (select a.sku_id, bp.production_overhead_cost_per_sku+bd.manufacturing_direct_labour_cost_per_sku before_conv, a.production_overhead_cost_per_sku+d.manufacturing_direct_labour_cost_per_sku after_conv, bp.monthly_sku_base_qty/nullif(bp.sku_base_qty_per_unit,0) units from costing.sku_production_overhead_allocation_snapshot a join costing.before_poh bp using(sku_id) join costing.sku_direct_labour_allocation_snapshot d using(sku_id) join costing.before_dl bd using(sku_id)) to '/tmp/au5_$mode.csv' csv header"
done
$P -c "select 1" 
