-- Gate B: Run-94 evidence-backed PM-BOM revision bootstrap.
-- Additive data only. No costing flip. No UI/MRP/current PLM mutation.
-- Fail-closed: any assertion failure rolls back the entire migration.

do $gate_b$
declare
  v_ts timestamptz := clock_timestamp();
  v_run94_skus integer;
  v_run94_lines integer;
  v_rev_count integer;
  v_line_count integer;
  v_approved integer;
  v_superseded integer;
  v_draft_cancelled integer;
  v_succ_lines integer;
  v_expected_lines integer;
  v_missing integer;
  v_extra integer;
  v_mismatch integer;
  v_hash_fail integer;
  v_rev1_853 bigint;
  v_rev2_853 bigint;
  v_asof public.plm_bom_revision%rowtype;
  v_has_matt integer;
  v_has_glossy integer;
  v_bad_header integer;
  v_bad_map integer;
  v_dup_groups integer;
  v_item_2702_created date;
  v_eff_2702 integer;
  v_eff_1369 integer;
begin
  -- ------------------------------------------------------------------
  -- 0. Idempotency / empty-state gate
  -- ------------------------------------------------------------------
  select count(*)::integer into v_rev_count from public.plm_bom_revision;
  select count(*)::integer into v_line_count from public.plm_bom_revision_line;
  if v_rev_count <> 0 or v_line_count <> 0 then
    raise exception
      'Gate B abort: plm_bom_revision already populated (headers=%, lines=%)',
      v_rev_count, v_line_count;
  end if;

  -- ------------------------------------------------------------------
  -- 1. Run-94 evidence shape
  -- ------------------------------------------------------------------
  select count(distinct sku_id)::integer, count(*)::integer
  into v_run94_skus, v_run94_lines
  from costing.sku_pm_material_cost_line_snapshot
  where refresh_run_id = 94;

  if v_run94_skus <> 672 then
    raise exception 'Gate B abort: expected 672 Run-94 PM SKUs, found %', v_run94_skus;
  end if;
  if v_run94_lines <> 2474 then
    raise exception 'Gate B abort: expected 2474 Run-94 PM lines, found %', v_run94_lines;
  end if;

  select count(*)::integer into v_dup_groups
  from (
    select sku_id, stock_item_id, uom_id
    from costing.sku_pm_material_cost_line_snapshot
    where refresh_run_id = 94
    group by 1, 2, 3
    having count(*) > 1
  ) d;
  if v_dup_groups <> 0 then
    raise exception 'Gate B abort: Run-94 PM snapshot has % duplicate sku/item/uom groups', v_dup_groups;
  end if;

  -- ------------------------------------------------------------------
  -- 2. Header / map evidence assertions (all 672 SKUs)
  -- ------------------------------------------------------------------
  select count(*)::integer into v_bad_header
  from (
    select distinct s.sku_id
    from costing.sku_pm_material_cost_line_snapshot s
    where s.refresh_run_id = 94
  ) r
  left join public.plm_bom_header h on h.sku_id = r.sku_id
  where h.id is null
     or h.last_updated_at::date > date '2026-09-10';

  if v_bad_header <> 0 then
    raise exception
      'Gate B abort: % Run-94 SKUs missing plm_bom_header or header last_updated_at > 2026-09-10',
      v_bad_header;
  end if;

  select count(*)::integer into v_bad_map
  from (
    select distinct s.sku_id
    from costing.sku_pm_material_cost_line_snapshot s
    where s.refresh_run_id = 94
  ) r
  left join public.plm_sku_pack_map m on m.sku_id = r.sku_id
  where m.sku_id is null
     or m.last_updated_at::date > date '2026-09-10';

  if v_bad_map <> 0 then
    raise exception
      'Gate B abort: % Run-94 SKUs missing plm_sku_pack_map or map last_updated_at > 2026-09-10',
      v_bad_map;
  end if;

  -- ------------------------------------------------------------------
  -- 3. SKU 853 successor safety assertions
  -- ------------------------------------------------------------------
  select i.created_at::date into v_item_2702_created
  from public.inv_stock_item i
  where i.id = 2702;

  if v_item_2702_created is null then
    raise exception 'Gate B abort: inv_stock_item 2702 does not exist';
  end if;
  if v_item_2702_created <> date '2026-09-12' then
    raise exception
      'Gate B abort: inv_stock_item 2702 created_at::date expected 2026-09-12, found %',
      v_item_2702_created;
  end if;

  select count(*)::integer into v_eff_2702
  from public.plm_sku_bom_effective(853) e
  where e.stock_item_id = 2702;
  select count(*)::integer into v_eff_1369
  from public.plm_sku_bom_effective(853) e
  where e.stock_item_id = 1369;
  select count(*)::integer into v_succ_lines
  from public.plm_sku_bom_effective(853);

  if v_eff_2702 <> 1 then
    raise exception 'Gate B abort: current effective SKU 853 must include item 2702';
  end if;
  if v_eff_1369 <> 0 then
    raise exception 'Gate B abort: current effective SKU 853 must exclude item 1369';
  end if;
  if v_succ_lines <> 4 then
    raise exception
      'Gate B abort: SKU 853 current effective line count expected 4, found % — stop rather than force 2478',
      v_succ_lines;
  end if;

  -- Run-94 SKU 853 must include Matt 1369 and exclude Glossy 2702
  if not exists (
    select 1
    from costing.sku_pm_material_cost_line_snapshot s
    where s.refresh_run_id = 94
      and s.sku_id = 853
      and s.stock_item_id = 1369
  ) then
    raise exception 'Gate B abort: Run-94 SKU 853 missing Matt item 1369';
  end if;
  if exists (
    select 1
    from costing.sku_pm_material_cost_line_snapshot s
    where s.refresh_run_id = 94
      and s.sku_id = 853
      and s.stock_item_id = 2702
  ) then
    raise exception 'Gate B abort: Run-94 SKU 853 unexpectedly contains Glossy item 2702';
  end if;

  v_expected_lines := v_run94_lines + v_succ_lines; -- 2474 + 4 = 2478

  -- ------------------------------------------------------------------
  -- 4. Insert DRAFT revision 1 for all 672 Run-94 SKUs
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
  )
  select
    r.sku_id,
    1,
    'DRAFT',
    date '2026-09-10',
    null,
    m.tpl_id,
    h.reference_output_qty,
    h.reference_output_uom_id,
    h.process_loss_pct,
    case
      when r.sku_id = 853 then 'RUN94_EVIDENCE_PREDECESSOR'
      else 'RUN94_EVIDENCE_BASELINE'
    end,
    case
      when r.sku_id = 853 then 'PLM-PM-BOM-RUN94-SKU853-MATT'
      else 'PLM-PM-BOM-RUN94-2026-09-10'
    end,
    v_ts,
    null
  from (
    select distinct sku_id
    from costing.sku_pm_material_cost_line_snapshot
    where refresh_run_id = 94
  ) r
  join public.plm_bom_header h on h.sku_id = r.sku_id
  join public.plm_sku_pack_map m on m.sku_id = r.sku_id;

  -- ------------------------------------------------------------------
  -- 5. Insert Run-94 frozen lines for all revision_no=1 drafts
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
  )
  select
    rev.id,
    row_number() over (
      partition by rev.id
      order by s.stock_item_id, s.uom_id
    )::integer,
    s.stock_item_id,
    s.qty_per_reference_output,
    s.uom_id,
    s.wastage_pct,
    coalesce(s.is_optional, false),
    coalesce(s.is_override, false),
    case when coalesce(s.is_override, false) then 'override' else 'template' end
  from public.plm_bom_revision rev
  join costing.sku_pm_material_cost_line_snapshot s
    on s.sku_id = rev.sku_id
   and s.refresh_run_id = 94
  where rev.revision_no = 1
    and rev.status = 'DRAFT';

  -- ------------------------------------------------------------------
  -- 6. Governed approve all revision_no=1 drafts
  -- ------------------------------------------------------------------
  perform set_config('app.plm_bom_revision_mutate_context', 'GOVERNED', true);

  update public.plm_bom_revision r
  set status = 'APPROVED',
      approved_at = v_ts,
      approved_by = null,
      frozen_at = v_ts,
      content_hash = public.fn_plm_bom_revision_compute_content_hash(r.id)
  where r.revision_no = 1
    and r.status = 'DRAFT';

  -- ------------------------------------------------------------------
  -- 7. SKU 853 revision 1 -> SUPERSEDED through 2026-09-11
  -- ------------------------------------------------------------------
  update public.plm_bom_revision r
  set status = 'SUPERSEDED',
      effective_to = date '2026-09-11',
      superseded_at = v_ts,
      superseded_by = null
  where r.sku_id = 853
    and r.revision_no = 1
    and r.status = 'APPROVED';

  select r.id into v_rev1_853
  from public.plm_bom_revision r
  where r.sku_id = 853
    and r.revision_no = 1;

  if v_rev1_853 is null then
    raise exception 'Gate B abort: SKU 853 predecessor revision missing after supersede';
  end if;

  -- ------------------------------------------------------------------
  -- 8. SKU 853 successor DRAFT (current effective / Glossy)
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
    supersedes_revision_id,
    created_at,
    created_by
  )
  select
    853,
    2,
    'DRAFT',
    date '2026-09-12',
    null,
    m.tpl_id,
    h.reference_output_qty,
    h.reference_output_uom_id,
    h.process_loss_pct,
    'PROSPECTIVE_GLOSSY_REPLACEMENT',
    'PLM-PM-BOM-SKU853-GLOSSY-2026-09-12',
    v_rev1_853,
    v_ts,
    null
  from public.plm_bom_header h
  join public.plm_sku_pack_map m on m.sku_id = h.sku_id
  where h.sku_id = 853
  returning id into v_rev2_853;

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
  )
  select
    v_rev2_853,
    row_number() over (order by e.stock_item_id, e.uom_id)::integer,
    e.stock_item_id,
    e.qty_per_reference_output,
    e.uom_id,
    e.wastage_pct,
    coalesce(e.is_optional, false),
    coalesce(e.is_override, false),
    case when coalesce(e.is_override, false) then 'override' else 'template' end
  from public.plm_sku_bom_effective(853) e;

  update public.plm_bom_revision r
  set status = 'APPROVED',
      approved_at = v_ts,
      approved_by = null,
      frozen_at = v_ts,
      content_hash = public.fn_plm_bom_revision_compute_content_hash(r.id),
      supersedes_revision_id = v_rev1_853
  where r.id = v_rev2_853
    and r.status = 'DRAFT';

  perform set_config('app.plm_bom_revision_mutate_context', '', true);

  -- ------------------------------------------------------------------
  -- 9. Count / status assertions
  -- ------------------------------------------------------------------
  select count(*)::integer into v_rev_count from public.plm_bom_revision;
  select count(*)::integer into v_line_count from public.plm_bom_revision_line;
  select count(*)::integer into v_approved from public.plm_bom_revision where status = 'APPROVED';
  select count(*)::integer into v_superseded from public.plm_bom_revision where status = 'SUPERSEDED';
  select count(*)::integer into v_draft_cancelled
  from public.plm_bom_revision
  where status in ('DRAFT', 'CANCELLED');

  if v_rev_count <> 673 then
    raise exception 'Gate B abort: expected 673 revisions, found %', v_rev_count;
  end if;
  if v_approved <> 672 then
    raise exception 'Gate B abort: expected 672 APPROVED, found %', v_approved;
  end if;
  if v_superseded <> 1 then
    raise exception 'Gate B abort: expected 1 SUPERSEDED, found %', v_superseded;
  end if;
  if v_draft_cancelled <> 0 then
    raise exception 'Gate B abort: unexpected DRAFT/CANCELLED count %', v_draft_cancelled;
  end if;
  if v_line_count <> v_expected_lines then
    raise exception
      'Gate B abort: expected % revision lines (2474 + %), found %',
      v_expected_lines, v_succ_lines, v_line_count;
  end if;

  -- ------------------------------------------------------------------
  -- 10. Content hash verification for every revision
  -- ------------------------------------------------------------------
  select count(*)::integer into v_hash_fail
  from public.plm_bom_revision r
  where r.content_hash is null
     or r.frozen_at is null
     or public.fn_plm_bom_revision_verify_content_hash(r.id) is distinct from true;

  if v_hash_fail <> 0 then
    raise exception 'Gate B abort: % revisions failed content_hash/frozen_at verification', v_hash_fail;
  end if;

  -- ------------------------------------------------------------------
  -- 11. Global 10-Sep Run-94 composition parity
  -- ------------------------------------------------------------------
  with expected as (
    select
      s.sku_id,
      s.stock_item_id,
      s.uom_id,
      s.qty_per_reference_output,
      s.wastage_pct,
      coalesce(s.is_optional, false) as is_optional,
      coalesce(s.is_override, false) as is_override
    from costing.sku_pm_material_cost_line_snapshot s
    where s.refresh_run_id = 94
  ),
  actual as (
    select
      rev.sku_id,
      l.stock_item_id,
      l.uom_id,
      l.qty_per_reference_output,
      l.wastage_pct,
      l.is_optional,
      l.is_override
    from public.plm_bom_revision rev
    join public.plm_bom_revision_line l on l.revision_id = rev.id
    where rev.status in ('APPROVED', 'SUPERSEDED')
      and rev.effective_from <= date '2026-09-10'
      and (rev.effective_to is null or rev.effective_to >= date '2026-09-10')
  )
  select
    (select count(*)::integer from expected e
     where not exists (
       select 1 from actual a
       where a.sku_id = e.sku_id
         and a.stock_item_id = e.stock_item_id
         and a.uom_id = e.uom_id
         and a.qty_per_reference_output is not distinct from e.qty_per_reference_output
         and a.wastage_pct is not distinct from e.wastage_pct
         and a.is_optional is not distinct from e.is_optional
         and a.is_override is not distinct from e.is_override
     )),
    (select count(*)::integer from actual a
     where not exists (
       select 1 from expected e
       where e.sku_id = a.sku_id
         and e.stock_item_id = a.stock_item_id
         and e.uom_id = a.uom_id
         and e.qty_per_reference_output is not distinct from a.qty_per_reference_output
         and e.wastage_pct is not distinct from a.wastage_pct
         and e.is_optional is not distinct from a.is_optional
         and e.is_override is not distinct from a.is_override
     )),
    (select count(*)::integer from expected e
     join actual a
       on a.sku_id = e.sku_id
      and a.stock_item_id = e.stock_item_id
      and a.uom_id = e.uom_id
     where a.qty_per_reference_output is distinct from e.qty_per_reference_output
        or a.wastage_pct is distinct from e.wastage_pct
        or a.is_optional is distinct from e.is_optional
        or a.is_override is distinct from e.is_override)
  into v_missing, v_extra, v_mismatch;

  if v_missing <> 0 or v_extra <> 0 or v_mismatch <> 0 then
    raise exception
      'Gate B abort: Run-94 as-of 2026-09-10 parity failed (missing=%, extra=%, mismatch=%)',
      v_missing, v_extra, v_mismatch;
  end if;

  -- ------------------------------------------------------------------
  -- 12. SKU 853 as-of boundary assertions
  -- ------------------------------------------------------------------
  v_asof := public.plm_sku_bom_revision_as_of(853, date '2026-09-10');
  if v_asof.id is distinct from v_rev1_853 or v_asof.status <> 'SUPERSEDED' then
    raise exception 'Gate B abort: as-of 2026-09-10 SKU 853 must resolve predecessor SUPERSEDED';
  end if;
  v_asof := public.plm_sku_bom_revision_as_of(853, date '2026-09-11');
  if v_asof.id is distinct from v_rev1_853 then
    raise exception 'Gate B abort: as-of 2026-09-11 SKU 853 must resolve predecessor';
  end if;
  v_asof := public.plm_sku_bom_revision_as_of(853, date '2026-09-12');
  if v_asof.id is distinct from v_rev2_853 or v_asof.status <> 'APPROVED' then
    raise exception 'Gate B abort: as-of 2026-09-12 SKU 853 must resolve successor APPROVED';
  end if;

  select count(*)::integer into v_has_matt
  from public.plm_sku_bom_lines_as_of(853, date '2026-09-10') l
  where l.stock_item_id = 1369;
  select count(*)::integer into v_has_glossy
  from public.plm_sku_bom_lines_as_of(853, date '2026-09-10') l
  where l.stock_item_id = 2702;
  if v_has_matt <> 1 or v_has_glossy <> 0 then
    raise exception 'Gate B abort: as-of 2026-09-10 SKU 853 must be Matt-only (1369)';
  end if;

  select count(*)::integer into v_has_matt
  from public.plm_sku_bom_lines_as_of(853, date '2026-09-11') l
  where l.stock_item_id = 1369;
  select count(*)::integer into v_has_glossy
  from public.plm_sku_bom_lines_as_of(853, date '2026-09-11') l
  where l.stock_item_id = 2702;
  if v_has_matt <> 1 or v_has_glossy <> 0 then
    raise exception 'Gate B abort: as-of 2026-09-11 SKU 853 must be Matt-only (1369)';
  end if;

  select count(*)::integer into v_has_glossy
  from public.plm_sku_bom_lines_as_of(853, date '2026-09-12') l
  where l.stock_item_id = 2702;
  select count(*)::integer into v_has_matt
  from public.plm_sku_bom_lines_as_of(853, date '2026-09-12') l
  where l.stock_item_id = 1369;
  if v_has_glossy <> 1 or v_has_matt <> 0 then
    raise exception 'Gate B abort: as-of 2026-09-12 SKU 853 must be Glossy-only (2702)';
  end if;

  raise notice
    'Gate B bootstrap OK: revisions=%, approved=%, superseded=%, lines=%, rev1_853=%, rev2_853=%',
    v_rev_count, v_approved, v_superseded, v_line_count, v_rev1_853, v_rev2_853;
exception
  when others then
    perform set_config('app.plm_bom_revision_mutate_context', '', true);
    raise;
end;
$gate_b$;
