create function costing.fn_preview_standard_batch_workload(p_refresh_run_id bigint)
returns table(refresh_run_id bigint,product_id bigint,product_name text,base_uom text,
batch_ref_id bigint,min_batch_size numeric,preferred_batch_size numeric,max_batch_size numeric,
manufacturing_labour_units_per_standard_batch numeric,overhead_units_per_standard_batch numeric,
foundation_status text)
language sql stable security invoker set search_path=costing,public,pg_temp as $$
with candidates as (
 select coalesce(d.product_id,h.product_id) product_id,
 coalesce(d.product_name,h.product_name) product_name,
 coalesce(d.product_base_uom,h.product_base_uom) base_uom,
 coalesce(d.valuation_date,h.valuation_date) valuation_date,
 d.direct_labour_route_intensity dl_route,h.route_factor oh_route,
 d.product_id is not null has_dl,h.product_id is not null has_oh
 from (select * from costing.product_direct_labour_workload_snapshot where refresh_run_id=p_refresh_run_id) d
 full join (select * from costing.product_production_overhead_workload_snapshot where refresh_run_id=p_refresh_run_id) h
 using(product_id)
), inputs as (
 select c.*,b.id ref_id,b.min_batch_size,b.preferred_batch_size,b.max_batch_size,
 row_number() over(partition by c.product_id order by b.effective_from desc nulls last,b.id desc nulls last) rn,
 count(b.id) over(partition by c.product_id) matching_refs
 from candidates c left join public.production_batch_size_ref b
 on b.product_id=c.product_id and b.is_active=true
 and b.effective_from<=c.valuation_date
 and (b.effective_to is null or b.effective_to>=c.valuation_date)
)
select p_refresh_run_id,i.product_id,i.product_name,i.base_uom,
i.ref_id,i.min_batch_size,i.preferred_batch_size,i.max_batch_size,
case when i.matching_refs=1 and i.has_dl and i.dl_route>=0 and i.min_batch_size>0
 and i.preferred_batch_size between i.min_batch_size and i.max_batch_size
 then i.dl_route else null end,
case when i.matching_refs=1 and i.has_oh and i.oh_route>=0 and i.min_batch_size>0
 and i.preferred_batch_size between i.min_batch_size and i.max_batch_size
 then i.oh_route else null end,
case when i.matching_refs=0 then 'MISSING_BATCH_REFERENCE'
 when i.matching_refs>1 then 'OVERLAPPING_BATCH_REFERENCES'
 when i.min_batch_size<=0 or i.preferred_batch_size not between i.min_batch_size and i.max_batch_size then 'INVALID_BATCH_LIMITS'
 when not i.has_dl or not i.has_oh or i.dl_route is null or i.oh_route is null
 then 'MISSING_ROUTE_WORKLOAD'
 when i.dl_route<0 or i.oh_route<0 then 'INVALID_ROUTE_WORKLOAD'
 else 'STANDARD_BATCH_REFERENCE_READY' end
from inputs i where i.rn=1
$$;
revoke all on function costing.fn_preview_standard_batch_workload(bigint) from public,anon,authenticated;
comment on function costing.fn_preview_standard_batch_workload(bigint) is 'Read-only standard one-preferred-batch route workload, not actual production activity, cost absorption, or saleable-yield evidence. Historical route intensities are reused without sales batch multipliers.';