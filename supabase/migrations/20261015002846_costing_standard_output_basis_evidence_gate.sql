create function costing.fn_preview_standard_output_basis_gate(p_refresh_run_id bigint)
returns table(product_id bigint,product_name text,base_uom text,preferred_batch_size numeric,rm_reference_qty numeric,rm_reference_uom text,standard_output_qty numeric,standard_output_status text,reference_relationship text)
language sql stable security invoker set search_path=costing,public,pg_temp as $$
with r as (
 select product_id,count(distinct (reference_output_qty,reference_output_uom_code)) distinct_refs,
 min(reference_output_qty) ref_qty,min(reference_output_uom_code) ref_uom
 from costing.product_rm_material_cost_line_snapshot
 where refresh_run_id=p_refresh_run_id group by product_id
)
select b.product_id,b.product_name,b.base_uom,b.preferred_batch_size,
r.ref_qty,r.ref_uom,null::numeric,
case when b.foundation_status<>'STANDARD_BATCH_REFERENCE_READY' then 'BLOCKED_STANDARD_BATCH_REFERENCE'
when r.product_id is null then 'REVIEW_REQUIRED_MISSING_RM_REFERENCE'
when r.distinct_refs<>1 then 'REVIEW_REQUIRED_CONFLICTING_RM_REFERENCE'
when r.ref_uom is distinct from b.base_uom then 'REVIEW_REQUIRED_RM_REFERENCE_UOM'
else 'REVIEW_REQUIRED_STANDARD_SALEABLE_OUTPUT_EVIDENCE' end,
case when r.ref_qty=b.preferred_batch_size then 'REFERENCE_EQUALS_PREFERRED'
else 'REFERENCE_DIFFERS_FROM_PREFERRED' end
from costing.fn_preview_standard_batch_workload(p_refresh_run_id) b
left join r on r.product_id=b.product_id
$$;
revoke all on function costing.fn_preview_standard_output_basis_gate(bigint) from public,anon,authenticated;
comment on function costing.fn_preview_standard_output_basis_gate(bigint) is 'Non-activating output/yield evidence gate; preferred manufacturing batch input and RM formulation reference are not presumed equal to verified saleable output.';