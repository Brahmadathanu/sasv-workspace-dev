CREATE OR REPLACE FUNCTION costing.fn_resolve_sku_commercial_base_context(p_sku_id bigint)
 RETURNS TABLE(sku_id bigint, product_id bigint, product_name text, pack_size numeric, pack_uom text, product_base_uom text, conversion_to_base numeric, sku_base_qty_per_unit numeric, sku_is_active boolean, product_is_active boolean, is_sample boolean, resolution_status text, resolution_note text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
with source_context as (
    select
        ps.id::bigint as sku_id,
        ps.product_id::bigint as product_id,
        p.item as product_name,

        ps.pack_size,
        ps.uom as pack_uom,

        p.uom_base as product_base_uom,
        p.conversion_to_base,

        case
            when ps.pack_size is null
              or ps.pack_size <= 0
              or p.conversion_to_base is null
              or p.conversion_to_base <= 0
                then null::numeric
            else
                ps.pack_size
                * p.conversion_to_base
        end as sku_base_qty_per_unit,

        ps.is_active as sku_is_active,

        (
            lower(
                btrim(
                    coalesce(
                        p.status,
                        ''
                    )
                )
            ) = 'active'
        ) as product_is_active,

        coalesce(
            ps.is_sample,
            false
        ) as is_sample

    from public.product_skus ps
    join public.products p
      on p.id = ps.product_id

    where ps.id = p_sku_id
)

select
    s.sku_id,
    s.product_id,
    s.product_name,

    s.pack_size,
    s.pack_uom,

    s.product_base_uom,
    s.conversion_to_base,
    s.sku_base_qty_per_unit,

    s.sku_is_active,
    s.product_is_active,
    s.is_sample,

    case
        when p_sku_id is null
            then 'INVALID_CONTEXT'

        when s.sku_id is null
            then 'NOT_FOUND'

        when s.sku_is_active is not true
          or s.product_is_active is not true
            then 'INACTIVE'

        when s.is_sample is true
            then 'SAMPLE_EXCLUDED'

        when s.pack_size is null
          or s.pack_size <= 0
          or s.pack_uom is null
          or btrim(s.pack_uom) = ''
          or s.product_base_uom is null
          or btrim(s.product_base_uom) = ''
          or s.conversion_to_base is null
          or s.conversion_to_base <= 0
          or s.sku_base_qty_per_unit is null
          or s.sku_base_qty_per_unit <= 0
            then 'BLOCKED'

        else 'RESOLVED'
    end as resolution_status,

    case
        when p_sku_id is null
            then
                'SKU ID is required.'

        when s.sku_id is null
            then
                'SKU does not exist.'

        when s.sku_is_active is not true
            then
                'SKU is inactive.'

        when s.product_is_active is not true
            then
                'Parent product is inactive.'

        when s.is_sample is true
            then
                'Sample SKU is excluded from regional commercial assumptions.'

        when s.pack_size is null
          or s.pack_size <= 0
            then
                'SKU pack size is missing or invalid.'

        when s.pack_uom is null
          or btrim(s.pack_uom) = ''
            then
                'SKU pack UOM is missing.'

        when s.product_base_uom is null
          or btrim(s.product_base_uom) = ''
            then
                'Product base UOM is missing.'

        when s.conversion_to_base is null
          or s.conversion_to_base <= 0
            then
                'Product conversion-to-base factor is missing or invalid.'

        when s.sku_base_qty_per_unit is null
          or s.sku_base_qty_per_unit <= 0
            then
                'SKU base quantity per unit could not be resolved.'

        else
            'SKU commercial base context resolved from governed SKU and product master data.'
    end as resolution_note

from (
    select 1
) anchor
left join source_context s
  on true;
$function$
