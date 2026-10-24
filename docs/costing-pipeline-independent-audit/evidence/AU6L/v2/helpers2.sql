\set ON_ERROR_STOP 1
\i /workspace/au6a/local_helpers.sql
-- Clone run 126, re-run the (patched) sales-basis writer, then restate product demand (commercial part) in the preview fixtures.
-- Internal (intermediate) demand is held at run-126 values (5 products) - the live chain recomputes it.
create or replace function costing.t_mkrun2(p_id bigint) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform costing.t_mkrun(p_id,false);
  select to_jsonb(x) into r from costing.rpc_refresh_sku_sales_allocation_basis_snapshot('2026-10-01','2026-10-16',p_id) x;
  create temp table tmp_c on commit drop as
    select d.product_id, coalesce(sum(b.monthly_allocation_base_qty),0) c_new
      from costing.demand_fixture d left join costing.sku_sales_allocation_basis_snapshot b on b.refresh_run_id=p_id and b.product_id=d.product_id
     where d.refresh_run_id=p_id group by d.product_id;
  update costing.demand_fixture d set commercial_base_qty=c.c_new, total_manufacturing_base_qty=coalesce(d.internal_base_qty,0)+c.c_new
    from tmp_c c where d.refresh_run_id=p_id and c.product_id=d.product_id;
  update costing.fx_foundation f set j=jsonb_set(j,'{rows}',(select jsonb_agg(case when d.product_id is null then x else x || jsonb_build_object(
        'monthly_product_base_qty',d.total_manufacturing_base_qty,
        'raw_batch_requirement',case when (x->>'preferred_batch_size')::numeric>0 then d.total_manufacturing_base_qty/(x->>'preferred_batch_size')::numeric end,
        'standard_batch_count',case when (x->>'preferred_batch_size')::numeric>0 then ceil(d.total_manufacturing_base_qty/(x->>'preferred_batch_size')::numeric) end) end)
      from jsonb_array_elements(j->'rows') x left join costing.demand_fixture d on d.refresh_run_id=p_id and d.product_id=(x->>'product_id')::bigint))
   where f.refresh_run_id=p_id;
  update costing.fx_dlprev f set j=jsonb_set(j,'{rows}',(select jsonb_agg(case when d.product_id is null then x else x || jsonb_build_object(
        'monthly_product_base_qty',d.total_manufacturing_base_qty,
        'raw_batch_requirement',case when (x->>'preferred_batch_size')::numeric>0 then d.total_manufacturing_base_qty/(x->>'preferred_batch_size')::numeric end,
        'standard_batch_count',case when (x->>'preferred_batch_size')::numeric>0 then ceil(d.total_manufacturing_base_qty/(x->>'preferred_batch_size')::numeric) end,
        'direct_labour_workload_units',case when (x->>'preferred_batch_size')::numeric>0 then (x->>'direct_labour_route_intensity')::numeric*ceil(d.total_manufacturing_base_qty/(x->>'preferred_batch_size')::numeric) end) end)
      from jsonb_array_elements(j->'rows') x left join costing.demand_fixture d on d.refresh_run_id=p_id and d.product_id=(x->>'product_id')::bigint))
   where f.refresh_run_id=p_id;
  return r;
end $$;
