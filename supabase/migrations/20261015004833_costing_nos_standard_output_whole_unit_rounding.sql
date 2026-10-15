create or replace function costing.fn_preview_standard_batch_net_output(p_refresh_run_id bigint)
returns table(product_id bigint,product_name text,base_uom text,preferred_batch_input numeric,rm_bom_id bigint,process_loss_fraction numeric,expected_net_output numeric,output_status text)
language sql stable set search_path=costing,public,pg_temp as $$
select b.product_id,b.product_name,b.base_uom,b.preferred_batch_size,h.id::bigint,h.process_loss_pct,
case when b.foundation_status='STANDARD_BATCH_REFERENCE_READY' and h.process_loss_pct>=0 and h.process_loss_pct<1
then case when lower(btrim(b.base_uom))='nos' then round(b.preferred_batch_size*(1-h.process_loss_pct),0)
else b.preferred_batch_size*(1-h.process_loss_pct) end else null::numeric end,
case when b.foundation_status<>'STANDARD_BATCH_REFERENCE_READY' then 'BLOCKED_BATCH_REFERENCE'
when h.id is null then 'BLOCKED_RM_BOM_MISSING'
when h.process_loss_pct is null or h.process_loss_pct<0 or h.process_loss_pct>=1 then 'BLOCKED_INVALID_LOSS'
when lower(btrim(b.base_uom))='nos' and round(b.preferred_batch_size*(1-h.process_loss_pct),0)<=0 then 'BLOCKED_ZERO_ROUNDED_OUTPUT'
when b.preferred_batch_size*(1-h.process_loss_pct)<=0 then 'BLOCKED_ZERO_OUTPUT'
else 'READY_EXPECTED_NET_OUTPUT' end
from costing.fn_preview_standard_batch_workload(p_refresh_run_id) b
left join public.rm_bom_header h on h.product_id=b.product_id
$$;
revoke all on function costing.fn_preview_standard_batch_net_output(bigint) from public,anon,authenticated;
comment on function costing.fn_preview_standard_batch_net_output(bigint) is 'Preferred batch expected net saleable output using canonical RM BOM header manufacturing process loss. Round nearest integer only for Nos; zero output blocked. Non-Nos retain precision. Preview only, no historical update.';