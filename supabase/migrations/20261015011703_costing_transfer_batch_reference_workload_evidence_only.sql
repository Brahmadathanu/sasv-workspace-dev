create function costing.fn_preview_transfer_batch_workload_evidence(p_refresh_run_id bigint,p_from date,p_to date)
returns table(evidence_category text,batch_identity_count bigint,manufacturing_labour_candidate_units numeric,overhead_candidate_units numeric)
language sql stable security invoker set search_path=costing,public,pg_temp as $$
with t as(
 select product_id,batch_code,bool_and(all_sku_mapped and qty_sum_uom_base is not null) mapped
 from public.v_tally_fg_transfer_daily_batch_agg
 where transfer_date between p_from and p_to and batch_code is not null
 group by product_id,batch_code
),j as(
 select t.*,w.product_id is not null foundation_found,
 w.manufacturing_labour_units_per_standard_batch labour,
 w.overhead_units_per_standard_batch overhead
 from t left join costing.fn_preview_standard_batch_workload(p_refresh_run_id) w on w.product_id=t.product_id
)
select case when not foundation_found then 'NO_COSTING_WORKLOAD'
when not mapped then 'TRANSFER_MAPPING_REVIEW'
else 'IDENTITY_MATCHED_UNVERIFIED_MANUFACTURING_EVENT' end,
count(*),sum(case when foundation_found and mapped then labour else 0 end),
sum(case when foundation_found and mapped then overhead else 0 end)
from j group by 1
$$;
revoke all on function costing.fn_preview_transfer_batch_workload_evidence(bigint,date,date) from public,anon,authenticated;
comment on function costing.fn_preview_transfer_batch_workload_evidence(bigint,date,date) is 'Reference-only proxy: one preferred-batch route workload per product and transfer batch-code identity, NOT validated actual manufacturing or normal capacity. Never use directly as an approved rate denominator.';