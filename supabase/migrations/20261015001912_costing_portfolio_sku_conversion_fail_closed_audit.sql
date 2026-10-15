create function costing.fn_preview_current_manufacturing_sku_conversion_gate()
returns table(product_id bigint,sku_id bigint,product_name text,pack_size numeric,pack_uom text,product_base_uom text,base_quantity_per_pack numeric,conversion_status text,conversion_source text)
language sql stable security invoker set search_path=costing,public,pg_temp as $$
 select p.id::bigint,s.id::bigint,p.item::text,s.pack_size::numeric,s.uom::text,p.uom_base::text,
 r.base_quantity_per_pack,r.conversion_status,r.mapping_source
 from public.product_skus s join public.products p on p.id=s.product_id
 left join lateral costing.fn_resolve_standard_sku_base_quantity(s.id) r on true
 where s.is_active and lower(btrim(p.status))='active'
 order by p.id,s.id
$$;
revoke all on function costing.fn_preview_current_manufacturing_sku_conversion_gate() from public,anon,authenticated;
comment on function costing.fn_preview_current_manufacturing_sku_conversion_gate() is 'Read-only current active SKU conversion verification, not historical replay or costing cutover. Unresolved dimensions remain null and REVIEW_REQUIRED.';