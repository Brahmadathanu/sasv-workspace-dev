-- Recreate BOM upsert function with explicit qualification to avoid ambiguous column references
-- Assumes unique constraint on rm_bom_header(product_id)
-- Adjust names if your actual schema differs.

create or replace function public.fn_rm_bom_upsert(
  p_product_id bigint,
  p_header     jsonb,
  p_lines      jsonb
) returns bigint
language plpgsql
as $$
declare
  v_hdr_id bigint;
  v_qty numeric(18,6);
  v_uom bigint;
begin
  if p_product_id is null then
    raise exception 'product_id required';
  end if;

  -- Upsert header using ON CONFLICT to avoid race conditions
  insert into rm_bom_header (
    product_id,
    reference_output_qty,
    reference_output_uom_id,
    process_loss_pct,
    notes
  ) values (
    p_product_id,
    coalesce((p_header->>'reference_output_qty')::numeric, 1),
    (p_header->>'reference_output_uom_id')::bigint,
    coalesce((p_header->>'process_loss_pct')::numeric, 0),
    null
  )
  on conflict (product_id) do update set
    reference_output_qty    = coalesce((excluded.reference_output_qty), rm_bom_header.reference_output_qty),
    reference_output_uom_id = coalesce((excluded.reference_output_uom_id), rm_bom_header.reference_output_uom_id),
    process_loss_pct        = coalesce((excluded.process_loss_pct), rm_bom_header.process_loss_pct),
    last_updated_at         = now()
  returning id into v_hdr_id;

  -- Replace all lines for this header id.
  delete from rm_bom_line l where l.rm_bom_id = v_hdr_id;

  if p_lines is not null and jsonb_typeof(p_lines) = 'array' then
    with parsed as (
      select
        row_number() over ()                                   as rn,
        (x->>'stock_item_id')::bigint                          as stock_item_id,
        (x->>'qty_per_reference_output')::numeric(18,6)        as qty_per_reference_output,
        (x->>'uom_id')::bigint                                 as uom_id,
        nullif(x->>'wastage_pct','')::numeric(6,4)             as wastage_pct,
        coalesce((x->>'is_optional')::boolean, false)          as is_optional,
        nullif(x->>'remarks','')                               as remarks
      from jsonb_array_elements(p_lines) as x
    )
    insert into rm_bom_line (
      rm_bom_id, line_no, stock_item_id, qty_per_reference_output, uom_id, wastage_pct, is_optional, remarks
    )
    select
      v_hdr_id, rn, stock_item_id, qty_per_reference_output, uom_id, wastage_pct, is_optional, remarks
    from parsed;
  end if;

  return v_hdr_id;
end;
$$;
