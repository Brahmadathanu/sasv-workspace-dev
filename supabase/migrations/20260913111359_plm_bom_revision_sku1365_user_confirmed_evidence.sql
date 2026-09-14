-- SOURCE-CONTROL PARITY
-- Already applied live as:
-- 20260913111359_plm_bom_revision_sku1365_user_confirmed_evidence
-- DO NOT reapply to production.
--
-- Evidence-backed PM-BOM revision for SKU 1365 Vaattu Kashayam 450 mL.
-- User-confirmed physical truth baseline effective 2026-09-10.

do $gate_b1$
declare
  v_ts timestamptz := clock_timestamp();
  v_prior integer;
  v_header_id bigint;
  v_header_updated date;
  v_ref_qty numeric;
  v_ref_uom bigint;
  v_loss numeric;
  v_tpl_id bigint;
  v_map_updated date;
  v_eff_count integer;
  v_eff_mismatch integer;
  v_revision_id bigint;
  v_hash_ok boolean;
  v_asof public.plm_bom_revision%rowtype;
begin
  -- ------------------------------------------------------------------
  -- 1. No prior governed revision for SKU 1365
  -- ------------------------------------------------------------------
  select count(*)::integer into v_prior
  from public.plm_bom_revision r
  where r.sku_id = 1365;

  if v_prior <> 0 then
    raise exception
      'Gate B.1 abort: SKU 1365 already has % plm_bom_revision row(s); refuse reapply',
      v_prior;
  end if;

  -- ------------------------------------------------------------------
  -- 2. Header / pack-map evidence dates and frozen header fields
  -- ------------------------------------------------------------------
  select
    h.id,
    h.last_updated_at::date,
    h.reference_output_qty,
    h.reference_output_uom_id,
    h.process_loss_pct
  into
    v_header_id,
    v_header_updated,
    v_ref_qty,
    v_ref_uom,
    v_loss
  from public.plm_bom_header h
  where h.sku_id = 1365;

  if v_header_id is null then
    raise exception 'Gate B.1 abort: plm_bom_header missing for SKU 1365';
  end if;
  if v_header_id <> 1326 then
    raise exception
      'Gate B.1 abort: expected plm_bom_header id 1326 for SKU 1365, found %',
      v_header_id;
  end if;
  if v_header_updated is distinct from date '2026-03-27' then
    raise exception
      'Gate B.1 abort: expected header last_updated_at::date 2026-03-27, found %',
      v_header_updated;
  end if;
  if v_header_updated >= date '2026-09-10' then
    raise exception
      'Gate B.1 abort: header last_updated_at % does not predate 2026-09-10',
      v_header_updated;
  end if;
  if v_ref_qty is distinct from 1::numeric
     or v_ref_uom is distinct from 5::bigint
     or v_loss is distinct from 0::numeric
  then
    raise exception
      'Gate B.1 abort: unexpected frozen header fields qty=% uom=% loss=%',
      v_ref_qty, v_ref_uom, v_loss;
  end if;

  select m.tpl_id, m.last_updated_at::date
  into v_tpl_id, v_map_updated
  from public.plm_sku_pack_map m
  where m.sku_id = 1365;

  if v_tpl_id is null then
    raise exception 'Gate B.1 abort: plm_sku_pack_map missing for SKU 1365';
  end if;
  if v_tpl_id <> 112 then
    raise exception
      'Gate B.1 abort: expected pack map tpl_id 112 for SKU 1365, found %',
      v_tpl_id;
  end if;
  if v_map_updated is distinct from date '2025-11-03' then
    raise exception
      'Gate B.1 abort: expected pack map last_updated_at::date 2025-11-03, found %',
      v_map_updated;
  end if;
  if v_map_updated >= date '2026-09-10' then
    raise exception
      'Gate B.1 abort: pack map last_updated_at % does not predate 2026-09-10',
      v_map_updated;
  end if;

  -- ------------------------------------------------------------------
  -- 3. Current effective BOM must exactly match the four confirmed lines
  -- ------------------------------------------------------------------
  select count(*)::integer into v_eff_count
  from public.plm_sku_bom_effective(1365) e;

  if v_eff_count <> 4 then
    raise exception
      'Gate B.1 abort: expected 4 current effective lines for SKU 1365, found %',
      v_eff_count;
  end if;

  with expected(stock_item_id, qty_per_reference_output, uom_id, wastage_pct, is_optional, is_override) as (
    values
      (1260::bigint, 0.083333::numeric, 5::bigint, 0::numeric, true,  false),
      (1363::bigint, 1::numeric,        5::bigint, 0::numeric, false, false),
      (1367::bigint, 1::numeric,        5::bigint, 0::numeric, false, false),
      (1676::bigint, 1::numeric,        5::bigint, 0::numeric, false, true)
  ),
  actual as (
    select
      e.stock_item_id,
      e.qty_per_reference_output,
      e.uom_id,
      e.wastage_pct,
      coalesce(e.is_optional, false) as is_optional,
      coalesce(e.is_override, false) as is_override
    from public.plm_sku_bom_effective(1365) e
  )
  select count(*)::integer into v_eff_mismatch
  from (
    select 1
    from expected x
    where not exists (
      select 1 from actual a
      where a.stock_item_id = x.stock_item_id
        and a.qty_per_reference_output is not distinct from x.qty_per_reference_output
        and a.uom_id is not distinct from x.uom_id
        and a.wastage_pct is not distinct from x.wastage_pct
        and a.is_optional is not distinct from x.is_optional
        and a.is_override is not distinct from x.is_override
    )
    union all
    select 1
    from actual a
    where not exists (
      select 1 from expected x
      where x.stock_item_id = a.stock_item_id
        and x.qty_per_reference_output is not distinct from a.qty_per_reference_output
        and x.uom_id is not distinct from a.uom_id
        and x.wastage_pct is not distinct from a.wastage_pct
        and x.is_optional is not distinct from a.is_optional
        and x.is_override is not distinct from a.is_override
    )
  ) d;

  if v_eff_mismatch <> 0 then
    raise exception
      'Gate B.1 abort: current effective BOM for SKU 1365 does not match user-confirmed four-line set';
  end if;

  -- ------------------------------------------------------------------
  -- 4. Insert DRAFT header (resolve IDs dynamically; do not hard-code revision id)
  -- ------------------------------------------------------------------
  insert into public.plm_bom_revision (
    sku_id,
    revision_no,
    status,
    effective_from,
    effective_to,
    source_tpl_id,
    frozen_reference_output_qty,
    frozen_reference_output_uom_id,
    frozen_process_loss_pct,
    change_reason,
    approval_reference,
    created_at,
    created_by
  ) values (
    1365,
    1,
    'DRAFT',
    date '2026-09-10',
    null,
    v_tpl_id,
    v_ref_qty,
    v_ref_uom,
    v_loss,
    'USER_CONFIRMED_PHYSICAL_TRUTH_BASELINE',
    'PLM-PM-BOM-SKU1365-CONFIRMED-20260913',
    v_ts,
    null
  )
  returning id into v_revision_id;

  -- ------------------------------------------------------------------
  -- 5. Insert four frozen lines (canonical order / source_op as confirmed)
  -- ------------------------------------------------------------------
  insert into public.plm_bom_revision_line (
    revision_id,
    line_no,
    stock_item_id,
    qty_per_reference_output,
    uom_id,
    wastage_pct,
    is_optional,
    is_override,
    source_op
  ) values
    (v_revision_id, 1, 1260, 0.083333, 5, 0, true,  false, 'tpl'),
    (v_revision_id, 2, 1363, 1,        5, 0, false, false, 'tpl'),
    (v_revision_id, 3, 1367, 1,        5, 0, false, false, 'tpl'),
    (v_revision_id, 4, 1676, 1,        5, 0, false, true,  'set');

  -- ------------------------------------------------------------------
  -- 6–8. Narrow GOVERNED context: DRAFT → APPROVED + canonical content hash
  -- ------------------------------------------------------------------
  perform set_config('app.plm_bom_revision_mutate_context', 'GOVERNED', true);

  update public.plm_bom_revision r
  set status = 'APPROVED',
      approved_at = v_ts,
      approved_by = null,
      frozen_at = v_ts,
      content_hash = public.fn_plm_bom_revision_compute_content_hash(r.id)
  where r.id = v_revision_id
    and r.status = 'DRAFT';

  perform set_config('app.plm_bom_revision_mutate_context', '', true);

  -- ------------------------------------------------------------------
  -- 9. Verify hash
  -- ------------------------------------------------------------------
  select public.fn_plm_bom_revision_verify_content_hash(v_revision_id)
  into v_hash_ok;

  if v_hash_ok is distinct from true then
    raise exception
      'Gate B.1 abort: content_hash verification failed for revision %',
      v_revision_id;
  end if;

  -- ------------------------------------------------------------------
  -- 10. Verify as-of 2026-09-10 returns this revision
  -- ------------------------------------------------------------------
  v_asof := public.plm_sku_bom_revision_as_of(1365, date '2026-09-10');

  if v_asof.id is distinct from v_revision_id then
    raise exception
      'Gate B.1 abort: as-of 2026-09-10 expected revision %, found %',
      v_revision_id, v_asof.id;
  end if;
  if v_asof.revision_no is distinct from 1
     or v_asof.status is distinct from 'APPROVED'
     or v_asof.effective_from is distinct from date '2026-09-10'
     or v_asof.effective_to is not null
  then
    raise exception
      'Gate B.1 abort: as-of revision shape mismatch (no=%, status=%, from=%, to=%)',
      v_asof.revision_no, v_asof.status, v_asof.effective_from, v_asof.effective_to;
  end if;
end;
$gate_b1$;
