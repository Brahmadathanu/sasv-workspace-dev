-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.rpc_get_material_vendor_rate_offers(
    p_stock_item_id bigint,
    p_limit integer default 50
)
returns table(
    rate_id bigint,
    vendor_id bigint,
    vendor_display_name text,
    stock_item_id bigint,
    stock_item_code text,
    stock_item_name text,
    material_class_id bigint,
    uom_id bigint,
    uom_code text,
    rate_value numeric,
    valid_from date,
    valid_to date,
    min_order_qty numeric,
    lead_time_days integer,
    remarks text
)
language plpgsql
stable
security definer
set search_path = public, costing, pg_temp
as $$
begin
    perform public.require_permission('module:material-cost-manager', false);

    if p_stock_item_id is null then
        raise exception 'Stock item ID is required';
    end if;

    return query
    select
        r.rate_id,
        r.vendor_id,
        v.display_name::text,
        r.stock_item_id,
        sic.code::text,
        sic.name::text,
        coalesce(r.material_class_id, sic.category_id),
        coalesce(r.uom_id, sic.default_uom_id),
        u.code::text,
        r.rate_value,
        r.valid_from,
        r.valid_to,
        r.min_order_qty,
        r.lead_time_days,
        r.remarks::text
    from public.proc_vendor_item_rate r
    join public.proc_vendor v
      on v.vendor_id = r.vendor_id
     and v.is_active = true
    join public.v_inv_stock_item_with_class sic
      on sic.stock_item_id = r.stock_item_id
    left join public.inv_uom u
      on u.id = coalesce(r.uom_id, sic.default_uom_id)
    where r.stock_item_id = p_stock_item_id
      and r.is_active = true
      and (r.valid_from is null or r.valid_from <= current_date)
      and (r.valid_to is null or r.valid_to >= current_date)
    order by r.rate_value asc, lower(v.display_name), r.rate_id
    limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

revoke all on function public.rpc_get_material_vendor_rate_offers(bigint,integer) from public, anon;
grant execute on function public.rpc_get_material_vendor_rate_offers(bigint,integer) to authenticated, service_role;

create or replace function public.rpc_set_material_manual_rate(
    p_stock_item_id bigint,
    p_rate_value numeric,
    p_effective_from date default current_date,
    p_reason text default null,
    p_rate_origin text default 'MANUAL_ENTRY',
    p_source_vendor_rate_id bigint default null,
    p_source_vendor_id bigint default null
)
returns table(
    manual_rate_id bigint,
    stock_item_id bigint,
    rate_value numeric,
    rate_uom_id bigint,
    effective_from date,
    effective_to date,
    status text,
    reason text,
    rate_origin text,
    source_vendor_rate_id bigint,
    source_vendor_id bigint,
    source_snapshot jsonb,
    created_at timestamptz,
    last_updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, costing, pg_temp
as $$
declare
    v_effective_from date;
    v_reason text;
    v_rate_origin text;
    v_vendor_offer record;
    v_saved costing.material_manual_rates%rowtype;
begin
    perform public.require_permission('module:material-cost-manager', true);

    if p_stock_item_id is null then
        raise exception 'Stock item ID is required';
    end if;

    if not exists (
        select 1
        from public.inv_stock_item i
        where i.id = p_stock_item_id
          and i.active = true
    ) then
        raise exception 'Active stock item not found';
    end if;

    if p_rate_value is null or p_rate_value <= 0 then
        raise exception 'Costing rate must be greater than zero';
    end if;

    v_effective_from := coalesce(p_effective_from, current_date);
    v_reason := nullif(trim(coalesce(p_reason, '')), '');

    if v_reason is null then
        raise exception 'Reason / approval reference is required';
    end if;

    v_rate_origin := upper(trim(coalesce(p_rate_origin, 'MANUAL_ENTRY')));

    if v_rate_origin not in ('MANUAL_ENTRY', 'VENDOR_RATE_BOOK') then
        raise exception 'Unsupported costing rate origin: %', v_rate_origin;
    end if;

    if v_rate_origin = 'MANUAL_ENTRY' then
        if p_source_vendor_rate_id is not null or p_source_vendor_id is not null then
            raise exception 'Vendor source fields are not allowed for manual entry';
        end if;
    else
        if p_source_vendor_rate_id is null then
            raise exception 'Vendor Rate Book rate ID is required';
        end if;

        select
            r.rate_id,
            r.vendor_id,
            v.display_name::text as vendor_display_name,
            r.stock_item_id,
            sic.code::text as stock_item_code,
            sic.name::text as stock_item_name,
            coalesce(r.material_class_id, sic.category_id) as material_class_id,
            coalesce(r.uom_id, sic.default_uom_id) as uom_id,
            u.code::text as uom_code,
            r.rate_value,
            r.valid_from,
            r.valid_to,
            r.min_order_qty,
            r.lead_time_days,
            r.remarks::text as remarks
        into v_vendor_offer
        from public.proc_vendor_item_rate r
        join public.proc_vendor v
          on v.vendor_id = r.vendor_id
         and v.is_active = true
        join public.v_inv_stock_item_with_class sic
          on sic.stock_item_id = r.stock_item_id
        left join public.inv_uom u
          on u.id = coalesce(r.uom_id, sic.default_uom_id)
        where r.rate_id = p_source_vendor_rate_id
          and r.stock_item_id = p_stock_item_id
          and r.is_active = true
          and (r.valid_from is null or r.valid_from <= current_date)
          and (r.valid_to is null or r.valid_to >= current_date);

        if not found then
            raise exception 'Effective Vendor Rate Book offer not found for this material';
        end if;

        if p_source_vendor_id is not null and p_source_vendor_id <> v_vendor_offer.vendor_id then
            raise exception 'Selected vendor does not match the Vendor Rate Book offer';
        end if;

        if p_rate_value <> v_vendor_offer.rate_value then
            raise exception 'Adopted costing rate must equal the selected Vendor Rate Book offer';
        end if;
    end if;

    update costing.material_manual_rates old_rate
    set
        status = 'INACTIVE',
        effective_to = case
            when old_rate.effective_from <= (v_effective_from - 1)
                then v_effective_from - 1
            else old_rate.effective_from
        end,
        last_updated_at = now(),
        last_updated_by = auth.uid()
    where old_rate.stock_item_id = p_stock_item_id
      and old_rate.status = 'ACTIVE';

    insert into costing.material_manual_rates (
        stock_item_id,
        rate_value,
        rate_uom_id,
        effective_from,
        effective_to,
        reason,
        status,
        rate_origin,
        source_vendor_rate_id,
        source_vendor_id,
        source_snapshot,
        created_by,
        last_updated_by
    )
    values (
        p_stock_item_id,
        p_rate_value,
        case when v_rate_origin = 'VENDOR_RATE_BOOK' then v_vendor_offer.uom_id else null end,
        v_effective_from,
        null,
        v_reason,
        'ACTIVE',
        v_rate_origin,
        case when v_rate_origin = 'VENDOR_RATE_BOOK' then v_vendor_offer.rate_id else null end,
        case when v_rate_origin = 'VENDOR_RATE_BOOK' then v_vendor_offer.vendor_id else null end,
        case when v_rate_origin = 'VENDOR_RATE_BOOK' then jsonb_build_object(
            'rate_id', v_vendor_offer.rate_id,
            'vendor_id', v_vendor_offer.vendor_id,
            'vendor_display_name', v_vendor_offer.vendor_display_name,
            'stock_item_id', v_vendor_offer.stock_item_id,
            'stock_item_code', v_vendor_offer.stock_item_code,
            'stock_item_name', v_vendor_offer.stock_item_name,
            'material_class_id', v_vendor_offer.material_class_id,
            'uom_id', v_vendor_offer.uom_id,
            'uom_code', v_vendor_offer.uom_code,
            'rate_value', v_vendor_offer.rate_value,
            'valid_from', v_vendor_offer.valid_from,
            'valid_to', v_vendor_offer.valid_to,
            'min_order_qty', v_vendor_offer.min_order_qty,
            'lead_time_days', v_vendor_offer.lead_time_days,
            'remarks', v_vendor_offer.remarks,
            'adopted_at', now()
        ) else null end,
        auth.uid(),
        auth.uid()
    )
    returning * into v_saved;

    return query
    select
        v_saved.id,
        v_saved.stock_item_id,
        v_saved.rate_value,
        v_saved.rate_uom_id,
        v_saved.effective_from,
        v_saved.effective_to,
        v_saved.status,
        v_saved.reason,
        v_saved.rate_origin,
        v_saved.source_vendor_rate_id,
        v_saved.source_vendor_id,
        v_saved.source_snapshot,
        v_saved.created_at,
        v_saved.last_updated_at;
end;
$$;

revoke all on function public.rpc_set_material_manual_rate(bigint,numeric,date,text,text,bigint,bigint) from public, anon;
grant execute on function public.rpc_set_material_manual_rate(bigint,numeric,date,text,text,bigint,bigint) to authenticated, service_role;