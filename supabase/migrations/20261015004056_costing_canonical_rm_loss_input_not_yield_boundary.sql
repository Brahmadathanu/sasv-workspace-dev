create function costing.fn_preview_canonical_rm_loss_boundary(p_refresh_run_id bigint)
returns table(product_id bigint,product_name text,preferred_batch_size numeric,base_uom text,rm_bom_id bigint,rm_reference_output_qty numeric,rm_process_loss_pct numeric,rm_input_multiplier numeric,output_basis_status text)
language sql stable security invoker set search_path=costing,public,pg_temp as $$
select b.product_id,b.product_name,b.preferred_batch_size,b.base_uom,
h.id::bigint,h.reference_output_qty,h.process_loss_pct,
case when h.process_loss_pct between 0 and 0.999999 then 1+h.process_loss_pct else null::numeric end,
case when h.id is null then 'BLOCKED_MISSING_RM_BOM'
when h.process_loss_pct is null or h.process_loss_pct<0 or h.process_loss_pct>=1 then 'BLOCKED_INVALID_PROCESS_LOSS'
else 'RM_INPUT_ALLOWANCE_VERIFIED_OUTPUT_NOT_INFERRED' end
from costing.fn_preview_standard_batch_workload(p_refresh_run_id) b
left join public.rm_bom_header h on h.product_id=b.product_id
$$;
revoke all on function costing.fn_preview_canonical_rm_loss_boundary(bigint) from public,anon,authenticated;
comment on function costing.fn_preview_canonical_rm_loss_boundary(bigint) is 'Read-only canonical RM BOM process-loss check. Process loss increases RM material input, and is NOT independently established finished-goods yield. Standard output is intentionally not inferred; historical costing untouched.';