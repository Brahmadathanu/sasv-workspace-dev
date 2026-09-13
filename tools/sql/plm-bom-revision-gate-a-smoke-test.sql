-- Gate A — PLM PM-BOM revision governance behavioral smoke
-- Run AFTER applying:
--   supabase/migrations/20260913093738_plm_bom_revision_governance_gate_a.sql
--
-- Uses a single DO block that raises a pass marker so fixture rows roll back.
-- Does not seed lasting business revisions. Does not touch costing / MRP / runs.

-- =============================================================================
-- A. Catalog / definition checks (read-only)
-- =============================================================================

select
  to_regclass('public.plm_bom_revision') is not null as has_revision_table,
  to_regclass('public.plm_bom_revision_line') is not null as has_revision_line_table;

select c.conname, pg_get_constraintdef(c.oid) as def
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname = 'plm_bom_revision'
  and c.conname in (
    'plm_bom_revision_status_chk',
    'plm_bom_revision_dates_chk',
    'plm_bom_revision_no_governed_overlap'
  )
order by c.conname;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname = 'uq_plm_bom_revision_one_open_approved';

select p.proname, p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'rpc_plm_bom_revision_create_draft',
    'rpc_plm_bom_revision_approve',
    'rpc_plm_bom_revision_cancel',
    'rpc_plm_bom_revision_list',
    'rpc_plm_bom_revision_get',
    'rpc_plm_bom_revision_list_lines',
    'plm_sku_bom_revision_as_of',
    'plm_sku_bom_lines_as_of',
    'plm_sku_requirement_unit_as_of',
    'fn_plm_bom_revision_build_content_hash',
    'fn_plm_bom_revision_verify_content_hash'
  )
order by p.proname;

-- Current-state regression: objects still present
select
  to_regprocedure('public.plm_sku_bom_effective(bigint)') is not null as has_effective,
  to_regclass('public.v_sku_plm_requirement_unit') is not null as has_requirement_view;

-- =============================================================================
-- B. Behavioral self-test (rolls back)
-- =============================================================================

do $smoke$
declare
  v_sku_id bigint;
  v_item_a bigint;
  v_item_b bigint;
  v_uom_id bigint;
  v_rev1 bigint;
  v_rev2 bigint;
  v_hash1 text;
  v_hash2 text;
  v_hash1b text;
  v_asof public.plm_bom_revision%rowtype;
  v_ok boolean;
  v_other bigint;
  v_line_count integer;
begin
  select s.id into v_sku_id from public.product_skus s order by s.id limit 1;
  if v_sku_id is null then
    raise exception 'self-test requires at least one product_skus row';
  end if;

  select u.id into v_uom_id from public.inv_uom u order by u.id limit 1;
  if v_uom_id is null then
    raise exception 'self-test requires at least one inv_uom row';
  end if;

  select i.id into v_item_a from public.inv_stock_item i order by i.id limit 1;
  select i.id into v_item_b from public.inv_stock_item i order by i.id offset 1 limit 1;
  if v_item_a is null or v_item_b is null or v_item_a = v_item_b then
    raise exception 'self-test requires at least two inv_stock_item rows';
  end if;

  -- invalid status rejected
  begin
    insert into public.plm_bom_revision (
      sku_id, revision_no, status, effective_from,
      frozen_reference_output_qty, frozen_reference_output_uom_id, frozen_process_loss_pct
    ) values (
      v_sku_id, 900001, 'BOGUS', date '2026-09-10', 1, v_uom_id, 0
    );
    raise exception 'expected invalid status rejection';
  exception
    when check_violation then null;
  end;

  -- Hash determinism
  v_hash1 := public.fn_plm_bom_revision_build_content_hash(
    v_sku_id, date '2026-09-10', 1, v_uom_id, 0, null,
    jsonb_build_array(
      jsonb_build_object(
        'line_no', 1,
        'stock_item_id', v_item_a,
        'qty_per_reference_output', 1,
        'uom_id', v_uom_id,
        'wastage_pct', null,
        'is_optional', false,
        'is_override', false,
        'source_op', 'template'
      )
    )
  );
  v_hash1b := public.fn_plm_bom_revision_build_content_hash(
    v_sku_id, date '2026-09-10', 1, v_uom_id, 0, null,
    jsonb_build_array(
      jsonb_build_object(
        'line_no', 1,
        'stock_item_id', v_item_a,
        'qty_per_reference_output', 1,
        'uom_id', v_uom_id,
        'wastage_pct', null,
        'is_optional', false,
        'is_override', false,
        'source_op', 'template'
      )
    )
  );
  if v_hash1 is distinct from v_hash1b then
    raise exception 'hash not deterministic';
  end if;

  v_hash2 := public.fn_plm_bom_revision_build_content_hash(
    v_sku_id, date '2026-09-10', 1, v_uom_id, 0, null,
    jsonb_build_array(
      jsonb_build_object(
        'line_no', 1,
        'stock_item_id', v_item_b,
        'qty_per_reference_output', 1,
        'uom_id', v_uom_id,
        'wastage_pct', null,
        'is_optional', false,
        'is_override', false,
        'source_op', 'template'
      )
    )
  );
  if v_hash1 = v_hash2 then
    raise exception 'hash did not change when line material changed';
  end if;

  insert into public.plm_bom_revision (
    sku_id, revision_no, status, effective_from,
    frozen_reference_output_qty, frozen_reference_output_uom_id, frozen_process_loss_pct
  ) values (
    v_sku_id, 910001, 'DRAFT', date '2026-09-10', 1, v_uom_id, 0
  ) returning id into v_rev1;

  insert into public.plm_bom_revision_line (
    revision_id, line_no, stock_item_id, qty_per_reference_output, uom_id,
    wastage_pct, is_optional, is_override, source_op
  ) values (
    v_rev1, 1, v_item_a, 1, v_uom_id, 0, false, false, 'template'
  );

  perform set_config('app.plm_bom_revision_mutate_context', 'GOVERNED', true);
  update public.plm_bom_revision
  set status = 'APPROVED',
      change_reason = 'gate-a self-test rev1',
      approved_at = clock_timestamp(),
      approved_by = null,
      frozen_at = clock_timestamp(),
      content_hash = public.fn_plm_bom_revision_compute_content_hash(v_rev1)
  where id = v_rev1;
  perform set_config('app.plm_bom_revision_mutate_context', '', true);

  select public.fn_plm_bom_revision_verify_content_hash(v_rev1) into v_ok;
  if v_ok is not true then
    raise exception 'stored content_hash failed verification for rev1';
  end if;

  begin
    update public.plm_bom_revision_line set qty_per_reference_output = 2 where revision_id = v_rev1;
    raise exception 'expected approved line update rejection';
  exception
    when raise_exception then
      if sqlerrm like 'expected approved line update rejection' then raise; end if;
  end;

  begin
    delete from public.plm_bom_revision_line where revision_id = v_rev1;
    raise exception 'expected approved line delete rejection';
  exception
    when raise_exception then
      if sqlerrm like 'expected approved line delete rejection' then raise; end if;
  end;

  begin
    update public.plm_bom_revision set change_reason = 'tamper' where id = v_rev1;
    raise exception 'expected approved header update rejection';
  exception
    when raise_exception then
      if sqlerrm like 'expected approved header update rejection' then raise; end if;
  end;

  insert into public.plm_bom_revision (
    sku_id, revision_no, status, effective_from,
    frozen_reference_output_qty, frozen_reference_output_uom_id, frozen_process_loss_pct
  ) values (
    v_sku_id, 910002, 'DRAFT', date '2026-09-12', 1, v_uom_id, 0
  ) returning id into v_rev2;

  insert into public.plm_bom_revision_line (
    revision_id, line_no, stock_item_id, qty_per_reference_output, uom_id,
    is_optional, is_override, source_op
  ) values (
    v_rev2, 1, v_item_b, 1, v_uom_id, false, false, 'template'
  );

  begin
    perform set_config('app.plm_bom_revision_mutate_context', 'GOVERNED', true);
    update public.plm_bom_revision
    set status = 'APPROVED',
        change_reason = 'should fail open unique',
        approved_at = clock_timestamp(),
        frozen_at = clock_timestamp(),
        content_hash = public.fn_plm_bom_revision_compute_content_hash(v_rev2)
    where id = v_rev2;
    perform set_config('app.plm_bom_revision_mutate_context', '', true);
    raise exception 'expected second open APPROVED rejection';
  exception
    when unique_violation then
      perform set_config('app.plm_bom_revision_mutate_context', '', true);
    when exclusion_violation then
      perform set_config('app.plm_bom_revision_mutate_context', '', true);
    when raise_exception then
      perform set_config('app.plm_bom_revision_mutate_context', '', true);
      if sqlerrm like 'expected second open APPROVED rejection' then raise; end if;
  end;

  perform set_config('app.plm_bom_revision_mutate_context', 'GOVERNED', true);
  update public.plm_bom_revision
  set status = 'SUPERSEDED',
      effective_to = date '2026-09-11',
      superseded_at = clock_timestamp(),
      superseded_by = null
  where id = v_rev1;

  update public.plm_bom_revision
  set status = 'APPROVED',
      effective_from = date '2026-09-12',
      change_reason = 'gate-a self-test rev2',
      approved_at = clock_timestamp(),
      frozen_at = clock_timestamp(),
      content_hash = public.fn_plm_bom_revision_compute_content_hash(v_rev2),
      supersedes_revision_id = v_rev1
  where id = v_rev2;
  perform set_config('app.plm_bom_revision_mutate_context', '', true);

  begin
    insert into public.plm_bom_revision (
      sku_id, revision_no, status, effective_from, effective_to,
      frozen_reference_output_qty, frozen_reference_output_uom_id, frozen_process_loss_pct,
      change_reason, approved_at, frozen_at, content_hash
    ) values (
      v_sku_id, 910003, 'APPROVED', date '2026-09-11', date '2026-09-11',
      1, v_uom_id, 0, 'overlap', clock_timestamp(), clock_timestamp(), 'x'
    );
    raise exception 'expected APPROVED/SUPERSEDED overlap rejection';
  exception
    when exclusion_violation then null;
    when raise_exception then
      if sqlerrm like 'expected APPROVED/SUPERSEDED overlap rejection' then raise; end if;
  end;

  v_asof := public.plm_sku_bom_revision_as_of(v_sku_id, date '2026-09-10');
  if v_asof.id is distinct from v_rev1 then
    raise exception 'as-of 2026-09-10 expected rev1';
  end if;
  v_asof := public.plm_sku_bom_revision_as_of(v_sku_id, date '2026-09-11');
  if v_asof.id is distinct from v_rev1 then
    raise exception 'as-of 2026-09-11 expected rev1';
  end if;
  v_asof := public.plm_sku_bom_revision_as_of(v_sku_id, date '2026-09-12');
  if v_asof.id is distinct from v_rev2 then
    raise exception 'as-of 2026-09-12 expected rev2';
  end if;

  insert into public.plm_bom_revision (
    sku_id, revision_no, status, effective_from,
    frozen_reference_output_qty, frozen_reference_output_uom_id, frozen_process_loss_pct
  ) values (
    v_sku_id, 910004, 'DRAFT', date '2026-09-10', 1, v_uom_id, 0
  );
  insert into public.plm_bom_revision (
    sku_id, revision_no, status, effective_from,
    frozen_reference_output_qty, frozen_reference_output_uom_id, frozen_process_loss_pct,
    cancelled_at
  ) values (
    v_sku_id, 910005, 'CANCELLED', date '2026-09-10', 1, v_uom_id, 0, clock_timestamp()
  );

  v_asof := public.plm_sku_bom_revision_as_of(v_sku_id, date '2026-09-10');
  if v_asof.id is distinct from v_rev1 then
    raise exception 'DRAFT/CANCELLED leaked into as-of resolution';
  end if;

  select s.id into v_other
  from public.product_skus s
  where s.id <> v_sku_id
  order by s.id
  limit 1;
  if v_other is not null then
    select count(*)::integer into v_line_count
    from public.plm_sku_bom_lines_as_of(v_other, date '2026-09-10');
    if v_line_count <> 0 then
      raise exception 'missing revision must not fall back to current PLM lines';
    end if;
    v_asof := public.plm_sku_bom_revision_as_of(v_other, date '2026-09-10');
    if v_asof.id is not null then
      raise exception 'missing revision header must be null (no fallback)';
    end if;
  end if;

  begin
    update public.plm_bom_revision_line set remarks = 'x' where revision_id = v_rev1;
    raise exception 'expected superseded line update rejection';
  exception
    when raise_exception then
      if sqlerrm like 'expected superseded line update rejection' then raise; end if;
  end;

  raise exception 'plm_bom_revision_gate_a_self_test_pass';
end;
$smoke$;
