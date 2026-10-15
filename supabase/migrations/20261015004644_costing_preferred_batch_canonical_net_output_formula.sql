create function costing.fn_preview_standard_batch_net_output(p_refresh_run_id bigint)
returns table(product_id bigint,product_name text,base_uom text,preferred_batch_input numeric,rm_bom_id bigint,process_loss_fraction numeric,expected_net_output numeric,output_status text)
language sql stable security invoker set search_path=costing,public,pg_temp as $$
select b.product_id,b.product_name,b.base_uom,b.preferred_batch_size,
h.id::bigint,h.process_loss_pct,
case when b.foundation_status='STANDARD_BATCH_REFERENCE_READY' and h.process_loss_pct>=0 and h.process_loss_pct<1
then b.preferred_batch_size*(1-h.process_loss_pct) else null::numeric end,
case when b.foundation_status<>'STANDARD_BATCH_REFERENCE_READY' then 'BLOCKED_BATCH_REFERENCE'
when h.id is null then 'BLOCKED_RM_BOM_MISSING'
when h.process_loss_pct is null or h.process_loss_pct<0 or h.process_loss_pct>=1 then 'BLOCKED_INVALID_LOSS'
when b.base_uom='Nos' and mod(b.preferred_batch_size*(1-h.process_loss_pct),1)<>0 then 'REVIEW_REQUIRED_FRACTIONAL_COUNT_OUTPUT'
else 'READY_EXPECTED_NET_OUTPUT' end
from costing.fn_preview_standard_batch_workload(p_refresh_run_id) b
left join public.rm_bom_header h on h.product_id=b.product_id
$$;
revoke all on function costing.fn_preview_standard_batch_net_output(bigint) from public,anon,authenticated;
comment on function costing.fn_preview_standard_batch_net_output(bigint) is 'Expected finished batch output = preferred batch manufacturing quantity × (1 - canonical RM BOM header process_loss_pct), as expressly confirmed by manufacturing owner. No RM BOM mutation; review gross-up in existing RM requirements before costing cutover to avoid double counting.';