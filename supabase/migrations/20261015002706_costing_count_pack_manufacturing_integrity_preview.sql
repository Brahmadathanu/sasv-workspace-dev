create function costing.fn_preview_count_pack_manufacturing_integrity()
returns table(product_id bigint,product_name text,sku_id bigint,pack_description text,
manufacturing_uom text,sku_base_quantity numeric,min_batch_size numeric,preferred_batch_size numeric,
integrity_status text)
language sql stable security invoker set search_path=costing,public,pg_temp as $$
select p.id::bigint,p.item::text,s.id::bigint,(s.pack_size::text||' '||s.uom)::text,
p.uom_base::text,r.base_quantity_per_pack,b.min_batch_size,b.preferred_batch_size,
case when p.uom_base<>'Nos' then 'BLOCKED_WRONG_MANUFACTURING_UOM'
when r.conversion_status<>'READY' or r.base_quantity_per_pack<>1 then 'BLOCKED_PACK_QUANTITY'
when b.id is null or b.min_batch_size<=0 or b.preferred_batch_size<b.min_batch_size then 'BLOCKED_BATCH_REFERENCE'
else 'READY' end
from public.products p join public.product_skus s on s.product_id=p.id and s.is_active
cross join lateral costing.fn_resolve_standard_sku_base_quantity(s.id) r
left join lateral (
 select * from public.production_batch_size_ref x where x.product_id=p.id and x.is_active
 order by x.effective_from desc,x.id desc limit 1
) b on true where p.id in(685,695)
$$;
revoke all on function costing.fn_preview_count_pack_manufacturing_integrity() from public,anon,authenticated;
comment on function costing.fn_preview_count_pack_manufacturing_integrity() is 'Non-activating integrity check for user-confirmed kit and Karkkidaka Kanji Nos-per-pack manufacturing conversion. Does not validate actual yields or modify batch sizes.';