-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_validate_internal_material_source_lineage(p_lineage_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'costing','public','pg_temp'
as $$
declare
  v costing.internal_material_source_lineage%rowtype;
  v_stock_name text;
  v_source_name text;
  v_source_status text;
  v_transfer_uom text;
  v_overlap_count bigint;
  v_cycle boolean := false;
  v_ok boolean;
  v_issues jsonb := '[]'::jsonb;
begin
  select * into v
  from costing.internal_material_source_lineage
  where id=p_lineage_id;

  if not found then
    return jsonb_build_object('ok',false,'lineage_id',p_lineage_id,'issues',jsonb_build_array('LINEAGE_NOT_FOUND'));
  end if;

  select name into v_stock_name from public.inv_stock_item where id=v.consume_stock_item_id;
  select item,status into v_source_name,v_source_status from public.products where id=v.source_product_id;
  select code into v_transfer_uom from public.inv_uom where id=v.transfer_uom_id;

  if v_source_status is distinct from 'Active' then
    v_issues := v_issues || jsonb_build_array('SOURCE_PRODUCT_NOT_ACTIVE');
  end if;

  if upper(coalesce(v_transfer_uom,'')) not in ('KG','L','NOS') then
    v_issues := v_issues || jsonb_build_array('UNSUPPORTED_TRANSFER_UOM');
  end if;

  select count(*) into v_overlap_count
  from costing.internal_material_source_lineage x
  where x.id<>v.id
    and x.consume_stock_item_id=v.consume_stock_item_id
    and x.status='APPROVED'
    and daterange(x.effective_from,coalesce(x.effective_to,'infinity'::date),'[]')
        && daterange(v.effective_from,coalesce(v.effective_to,'infinity'::date),'[]');

  if v_overlap_count>0 then
    v_issues := v_issues || jsonb_build_array('OVERLAPPING_APPROVED_LINEAGE');
  end if;

  /*
    Cycle semantics are based on actual BOM dependencies, not name equality.
    Each active/draft lineage creates graph edges:
      consumer Product (whose RM BOM consumes the stock item)
        -> source Product.
    The candidate is cyclic only if its source Product can already reach one
    of the candidate's consumer Products through that graph.
  */
  with recursive all_lineage as (
    select x.consume_stock_item_id,x.source_product_id
    from costing.internal_material_source_lineage x
    where x.status in ('DRAFT','APPROVED')
  ), edges as (
    select distinct h.product_id as consumer_product_id,
                    l.source_product_id
    from public.rm_bom_header h
    join public.rm_bom_line bl on bl.rm_bom_id=h.id
    join all_lineage l on l.consume_stock_item_id=bl.stock_item_id
  ), candidate_consumers as (
    select distinct h.product_id
    from public.rm_bom_header h
    join public.rm_bom_line bl on bl.rm_bom_id=h.id
    where bl.stock_item_id=v.consume_stock_item_id
  ), walk(product_id,path,depth) as (
    select v.source_product_id,array[v.source_product_id]::bigint[],0
    union all
    select e.source_product_id,w.path||e.source_product_id,w.depth+1
    from walk w
    join edges e on e.consumer_product_id=w.product_id
    where w.depth<30
      and not e.source_product_id=any(w.path)
  )
  select exists(
    select 1
    from walk w
    join candidate_consumers c on c.product_id=w.product_id
  ) into v_cycle;

  if v_cycle then
    v_issues := v_issues || jsonb_build_array('LINEAGE_CYCLE_DETECTED');
  end if;

  v_ok := jsonb_array_length(v_issues)=0;

  return jsonb_build_object(
    'ok',v_ok,
    'lineage_id',v.id,
    'status',v.status,
    'consume_stock_item_id',v.consume_stock_item_id,
    'consume_stock_item_name',v_stock_name,
    'source_product_id',v.source_product_id,
    'source_product_name',v_source_name,
    'source_product_status',v_source_status,
    'transfer_uom',v_transfer_uom,
    'effective_from',v.effective_from,
    'effective_to',v.effective_to,
    'overlapping_approved_count',v_overlap_count,
    'cycle_detected',v_cycle,
    'issues',v_issues
  );
end;
$$;