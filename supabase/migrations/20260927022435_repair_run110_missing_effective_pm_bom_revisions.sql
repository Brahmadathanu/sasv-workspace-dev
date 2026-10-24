-- backfilled from live schema_migrations on 2026-10-24, CI-016

do $repair$
declare
  v_ts timestamptz := clock_timestamp();
  v_rev207 bigint;
  v_rev1798 bigint;
  v_hdr1798 bigint;
  v_count integer;
begin
  -- Preconditions: exact blocker set.
  if exists (select 1 from public.plm_bom_revision where sku_id in (207,1798)) then
    raise exception 'Repair abort: SKU207/1798 revision unexpectedly already exists';
  end if;

  if not exists (
    select 1 from public.plm_sku_pack_map
    where sku_id=207 and tpl_id=10
  ) then
    raise exception 'Repair abort: SKU207 must already map to template 10';
  end if;

  select count(*)::integer into v_count
  from public.plm_sku_bom_effective(207);
  if v_count <> 4 then
    raise exception 'Repair abort: SKU207 effective BOM expected 4 lines, found %', v_count;
  end if;

  if exists (select 1 from public.plm_sku_pack_map where sku_id=1798)
     or exists (select 1 from public.plm_bom_header where sku_id=1798)
     or exists (select 1 from public.plm_sku_plm_override where sku_id=1798)
  then
    raise exception 'Repair abort: SKU1798 PLM state changed since investigation';
  end if;

  -- Peer-pattern assertions for 100 g Kashaya Choornam.
  if not exists (
    select 1 from public.plm_sku_pack_map where sku_id=167 and tpl_id=5
  ) or not exists (
    select 1 from public.plm_sku_pack_map where sku_id=1351 and tpl_id=5
  ) then
    raise exception 'Repair abort: peer 100 g Kashaya Choornam template pattern changed';
  end if;

  if not exists (
    select 1 from public.plm_sku_plm_override
    where sku_id=167 and op='set' and stock_item_id=1676
      and qty_per_reference_output=1 and uom_id=5
  ) or not exists (
    select 1 from public.plm_sku_plm_override
    where sku_id=1351 and op='set' and stock_item_id=1676
      and qty_per_reference_output=1 and uom_id=5
  ) then
    raise exception 'Repair abort: peer 100 g Kashaya Choornam label override pattern changed';
  end if;

  -- Repair missing current PM master for SKU1798.
  insert into public.plm_sku_pack_map(sku_id,tpl_id,notes)
  values (1798,5,'Run110 master-data repair: align active 100 g Kashaya Choornam with established Powder PP Packing pattern');

  insert into public.plm_sku_plm_override(
    sku_id,op,stock_item_id,qty_per_reference_output,uom_id,wastage_pct,is_optional,remarks
  )
  values (
    1798,'set',1676,1,5,0,false,
    'Run110 master-data repair: General Label - Special Products per established 100 g Kashaya Choornam pattern'
  );

  perform public.rpc_plm_rebuild_sku(1798);

  select id into v_hdr1798
  from public.plm_bom_header
  where sku_id=1798;

  if v_hdr1798 is null then
    raise exception 'Repair abort: SKU1798 compiled BOM header was not created';
  end if;

  select count(*)::integer into v_count
  from public.plm_sku_bom_effective(1798);
  if v_count <> 3 then
    raise exception 'Repair abort: SKU1798 effective BOM expected 3 lines, found %', v_count;
  end if;

  -- Create two backend evidence revisions using the sanctioned RUN94 bootstrap pattern.
  insert into public.plm_bom_revision(
    sku_id,revision_no,status,effective_from,effective_to,source_tpl_id,
    frozen_reference_output_qty,frozen_reference_output_uom_id,frozen_process_loss_pct,
    change_reason,approval_reference,created_at,created_by
  )
  select
    h.sku_id,1,'DRAFT',date '2026-09-10',null,m.tpl_id,
    h.reference_output_qty,h.reference_output_uom_id,h.process_loss_pct,
    'RUN110_MASTER_DATA_REPAIR',
    case h.sku_id
      when 207 then 'PLM-PM-BOM-RUN110-REPAIR-SKU207-2026-09-10'
      when 1798 then 'PLM-PM-BOM-RUN110-REPAIR-SKU1798-2026-09-10'
    end,
    v_ts,null
  from public.plm_bom_header h
  join public.plm_sku_pack_map m on m.sku_id=h.sku_id
  where h.sku_id in (207,1798);

  if not found then
    raise exception 'Repair abort: revision headers not inserted';
  end if;

  select id into v_rev207
  from public.plm_bom_revision
  where sku_id=207 and revision_no=1 and status='DRAFT';

  select id into v_rev1798
  from public.plm_bom_revision
  where sku_id=1798 and revision_no=1 and status='DRAFT';

  if v_rev207 is null or v_rev1798 is null then
    raise exception 'Repair abort: expected draft revisions not found';
  end if;

  insert into public.plm_bom_revision_line(
    revision_id,line_no,stock_item_id,qty_per_reference_output,uom_id,
    wastage_pct,is_optional,is_override,source_op
  )
  select
    r.id,
    row_number() over(partition by r.id order by e.stock_item_id,e.uom_id)::integer,
    e.stock_item_id,e.qty_per_reference_output,e.uom_id,e.wastage_pct,
    coalesce(e.is_optional,false),coalesce(e.is_override,false),
    case when coalesce(e.is_override,false) then 'override' else 'template' end
  from public.plm_bom_revision r
  cross join lateral public.plm_sku_bom_effective(r.sku_id) e
  where r.id in (v_rev207,v_rev1798);

  select count(*)::integer into v_count
  from public.plm_bom_revision_line
  where revision_id in (v_rev207,v_rev1798);
  if v_count <> 7 then
    raise exception 'Repair abort: expected 7 frozen revision lines, found %', v_count;
  end if;

  perform set_config('app.plm_bom_revision_mutate_context','GOVERNED',true);

  update public.plm_bom_revision r
  set status='APPROVED',
      approved_at=v_ts,
      approved_by=null,
      frozen_at=v_ts,
      content_hash=public.fn_plm_bom_revision_compute_content_hash(r.id)
  where r.id in (v_rev207,v_rev1798)
    and r.status='DRAFT';

  perform set_config('app.plm_bom_revision_mutate_context','',true);

  if public.fn_plm_bom_revision_verify_content_hash(v_rev207) is distinct from true
     or public.fn_plm_bom_revision_verify_content_hash(v_rev1798) is distinct from true
  then
    raise exception 'Repair abort: revision content hash verification failed';
  end if;

  if (public.plm_sku_bom_revision_as_of(207,date '2026-09-10')).id is distinct from v_rev207 then
    raise exception 'Repair abort: SKU207 does not resolve repaired revision as-of 2026-09-10';
  end if;

  if (public.plm_sku_bom_revision_as_of(1798,date '2026-09-10')).id is distinct from v_rev1798 then
    raise exception 'Repair abort: SKU1798 does not resolve repaired revision as-of 2026-09-10';
  end if;

exception
  when others then
    perform set_config('app.plm_bom_revision_mutate_context','',true);
    raise;
end;
$repair$;
