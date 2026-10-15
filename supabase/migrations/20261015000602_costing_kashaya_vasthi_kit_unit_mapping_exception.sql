create table costing.sku_base_quantity_exception (
 sku_id bigint primary key references public.product_skus(id),
 product_id bigint not null references public.products(id),
 sku_base_qty_per_unit numeric(24,8) not null check(sku_base_qty_per_unit>0),
 base_uom text not null,
 explanation text not null,
 approval_reference text not null,
 approved_by uuid not null,
 approved_at timestamptz not null default clock_timestamp(),
 created_at timestamptz not null default clock_timestamp(),
 constraint sku_base_quantity_kit_specific check (sku_id=865 and product_id=685 and sku_base_qty_per_unit=1 and base_uom='Nos')
);
revoke all on costing.sku_base_quantity_exception from public,anon,authenticated;
create function costing.fn_resolve_standard_sku_base_quantity(p_sku_id bigint)
returns table(sku_id bigint,product_id bigint,base_uom text,base_quantity_per_pack numeric,
 mapping_source text,conversion_status text)
language sql stable security invoker set search_path=costing,public,pg_temp as $$
 select s.id::bigint,p.id::bigint,p.uom_base::text,
 case when x.sku_id is not null and x.product_id=p.id and x.base_uom=p.uom_base
 then x.sku_base_qty_per_unit
 when x.sku_id is null and lower(btrim(s.uom))=lower(btrim(p.uom_base))
 then s.pack_size::numeric
 when x.sku_id is null and p.uom_base='Kg' and lower(btrim(s.uom))='g'
 then s.pack_size::numeric/1000
 else null::numeric end,
 case when x.sku_id is not null then 'GOVERNED_KIT_EXCEPTION' else 'EXPLICIT_UNIT_CONVERSION' end,
 case when s.is_active is not true or lower(coalesce(p.status,''))<>'active' then 'INACTIVE'
 when x.sku_id is not null and (x.product_id<>p.id or x.base_uom<>p.uom_base) then 'BLOCKED_EXCEPTION_MASTER_MISMATCH'
 when x.sku_id is not null then 'READY'
 when lower(btrim(s.uom))=lower(btrim(p.uom_base)) then 'READY'
 when p.uom_base='Kg' and lower(btrim(s.uom))='g' then 'READY'
 else 'REVIEW_REQUIRED_DIMENSIONAL_CONVERSION' end
 from public.product_skus s join public.products p on p.id=s.product_id
 left join costing.sku_base_quantity_exception x on x.sku_id=s.id
 where s.id=p_sku_id
$$;
revoke all on function costing.fn_resolve_standard_sku_base_quantity(bigint) from public,anon,authenticated;
insert into costing.sku_base_quantity_exception(sku_id,product_id,sku_base_qty_per_unit,base_uom,explanation,approval_reference,approved_by)
select s.id,s.product_id,1,'Nos',
 'One Kashaya Vasthi Kit contains separately packed components of combined net weight 275 g. The completed kit is one countable Nos for manufacturing costing; 275 g remains the commercial pack description.',
 'USER_CONFIRMED_KASHAYA_VASTHI_KIT_1_NOS_2026_10_15',
 'dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid
from public.product_skus s join public.products p on p.id=s.product_id
where s.id=865 and s.product_id=685 and s.pack_size=275 and lower(s.uom)='g'
and p.uom_base='Nos' and p.conversion_to_base=1 and s.is_active=true;
do $$ begin if (select count(*) from costing.sku_base_quantity_exception where sku_id=865)<>1 then raise exception 'Kit conversion evidence mismatch; rollback'; end if; end $$;
comment on table costing.sku_base_quantity_exception is 'Governed costing-specific dimensional exception. Not a change to physical pack description, SKU master, historical snapshots or commercial unit conversion. Requires explicit integration at costing cutover.';