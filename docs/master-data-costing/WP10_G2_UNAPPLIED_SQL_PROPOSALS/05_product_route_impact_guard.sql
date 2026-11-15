-- WP10 G2 PROPOSAL 05 — UNAPPLIED. DO NOT RUN without separate, exact, owner-authorised operational approval.
-- Owner decision O4: supported route-changing product edits need an impact/remediation REVIEW; do NOT blanket-block subgroup edits.
-- Contract: a change of products.sub_group_id on a product with at least one ACTIVE SKU is REJECTED when the route goes valid -> invalid
--   (WP10_PRODUCT_ROUTE_IMPACT) or when the impact cannot be determined (WP10_PRODUCT_ROUTE_IMPACT_UNRESOLVED, review required).
--   Validity is the LIVE canonical costing.fn_validate_effective_product_process_route(product, today IST) — no duplicated resolver logic.
-- Allowed (normal edits unaffected): any edit not touching sub_group_id; subgroup moves with no active SKU; moves after which the route is valid;
--   moves where the route was already invalid AND stays invalid (nothing newly lost).
-- REJECTED with a distinct review-required reason (WP10_PRODUCT_ROUTE_IMPACT_UNRESOLVED) when the impact cannot be proven safe: the evaluation
--   errors or returns a malformed result AFTER the move, or BEFORE it with an invalid result after. Unknown is never read as 'no impact' (R1). No override.
-- Error text names the remediation. Rollback of a rejected statement is automatic (AFTER-row trigger raises inside the writer's transaction), so
-- rpc_update_product's product row AND its product_master_audit row are not committed.
-- UNRESOLVED CONTRACT (returned, not invented): a read-only IMPACT PREVIEW before submit would need a date/subgroup-parameterised route resolver
-- (new logic) or a rollback-based dry run (a write); neither is authorised. An owner-approved override/exception workflow is likewise NOT defined here.
-- Out of scope: edits to sub_groups.product_group_id (affects many products) and route-mapping table edits themselves.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- PROVENANCE PREFLIGHT (R5): refuses to run when any object this file creates already exists (it never overwrites or adopts), when a live dependency
-- differs from the definition that was reviewed (md5 of pg_get_functiondef), or when a prerequisite proposal is missing or was modified after it was
-- applied. Re-running this file therefore FAILS at this block by design; a partial apply is impossible because the file is one transaction.
do $wp10_preflight$
declare t text; r record; v oid; c text;
begin
  foreach t in array array['public.fn_wp10_product_route_impact_before()', 'public.fn_wp10_product_route_impact_after()'] loop
    if to_regprocedure(t) is not null then
      raise exception 'WP10-G2 preflight: % already exists; refusing to overwrite or adopt it (review the existing definition separately).', t;
    end if;
  end loop;
  if exists (select 1 from pg_trigger where tgname = 'trg_wp10_product_route_impact_before' and tgrelid = 'public.products'::regclass and not tgisinternal) then
    raise exception 'WP10-G2 preflight: trigger trg_wp10_product_route_impact_before on public.products already exists; refusing to overwrite or adopt it.';
  end if;
  if exists (select 1 from pg_trigger where tgname = 'trg_wp10_product_route_impact_after' and tgrelid = 'public.products'::regclass and not tgisinternal) then
    raise exception 'WP10-G2 preflight: trigger trg_wp10_product_route_impact_after on public.products already exists; refusing to overwrite or adopt it.';
  end if;
  for r in select * from (values
    ('costing.fn_resolve_route_family_for_product(integer, date)', '641fd0f7eb7438eed53c1c6170deb0ec'),
    ('costing.fn_validate_effective_product_process_route(integer, date)', 'a9396f97a23cba5bbaceada07bc6448a'),
    ('costing.fn_resolve_effective_product_process_route(integer, date)', '3c5a292804748daf679605382e1691fb'),
    ('costing.fn_resolve_effective_route_family_route(integer, date)', '5d7ac1d9e0427eae90b590ead55fe58a'),
    ('costing.fn_validate_product_process_route(bigint)', 'cc6cef1fac171ce812c9dd6702e4efbc'),
    ('costing.fn_validate_route_family_route(bigint)', '09cd3572e36000095b8b1eb1833491c8'),
    ('costing.fn_effective_product_process_route_steps(bigint)', '0968054cfb097874f54239c1c2ce3ab5')
  ) as d(sig, expected_md5) loop
    v := to_regprocedure(r.sig);
    if v is null then raise exception 'WP10-G2 preflight: required live function % is missing.', r.sig; end if;
    if md5(pg_get_functiondef(v)) <> r.expected_md5 then
      raise exception 'WP10-G2 preflight: live function % differs from the reviewed definition (md5 %, reviewed %); re-review before applying.', r.sig, md5(pg_get_functiondef(v)), r.expected_md5;
    end if;
  end loop;
  foreach t in array array['costing.fn_wp10_today_ist()', 'costing.fn_wp10_batch_size_state_as_of(bigint, date)'] loop
    v := to_regprocedure(t);
    c := case when v is null then null else obj_description(v, 'pg_proc') end;
    if v is null or c is null or c not like 'WP10-G2 01\_%' or split_part(c, 'md5:', 2) <> md5(pg_get_functiondef(v)) then
      raise exception 'WP10-G2 preflight: prerequisite % (proposal 01) is missing, not applied by this procedure, or modified since.', t;
    end if;
  end loop;
end $wp10_preflight$;

create function public.fn_wp10_product_route_impact_before()
returns trigger
language plpgsql
security definer
set search_path = public, costing, pg_temp
as $fn$
declare v_val text;
begin
  if new.sub_group_id is not distinct from old.sub_group_id then return new; end if;
  if not exists (select 1 from public.product_skus s where s.product_id = old.id and s.is_active) then return new; end if;
  -- three-valued: valid | invalid | unknown (evaluation error OR a result without a boolean 'valid'). Unknown is never read as safe.
  begin
    v_val := (costing.fn_validate_effective_product_process_route(old.id, costing.fn_wp10_today_ist()) ->> 'valid');
    v_val := case when v_val = 'true' then 'valid' when v_val = 'false' then 'invalid' else 'unknown' end;
  exception when others then v_val := 'unknown';
  end;
  perform set_config('wp10.rv_' || old.id::text, v_val, true);
  return new;
end
$fn$;

create function public.fn_wp10_product_route_impact_after()
returns trigger
language plpgsql
security definer
set search_path = public, costing, pg_temp
as $fn$
declare
  v_before text;
  v_after text;
  v_active integer;
begin
  if new.sub_group_id is not distinct from old.sub_group_id then return null; end if;
  select count(*) into v_active from public.product_skus s where s.product_id = new.id and s.is_active;
  if v_active = 0 then return null; end if;
  -- a missing "before" receipt (e.g. the BEFORE trigger was disabled) is UNKNOWN, never safe
  v_before := coalesce(nullif(current_setting('wp10.rv_' || new.id::text, true), ''), 'unknown');
  perform set_config('wp10.rv_' || new.id::text, '', true);
  begin
    v_after := (costing.fn_validate_effective_product_process_route(new.id, costing.fn_wp10_today_ist()) ->> 'valid');
    v_after := case when v_after = 'true' then 'valid' when v_after = 'false' then 'invalid' else 'unknown' end;
  exception when others then v_after := 'unknown';
  end;
  -- allowed: after valid; or invalid -> invalid (nothing newly lost)
  if v_after = 'valid' or (v_before = 'invalid' and v_after = 'invalid') then return null; end if;
  if v_before = 'valid' and v_after = 'invalid' then
    raise exception using
      errcode = 'P0001',
      message = format('WP10_PRODUCT_ROUTE_IMPACT: moving product %s to sub-group %s would remove its valid production route while %s active SKU(s) exist.', new.id, new.sub_group_id, v_active),
      hint = 'Map the new sub-group (or group) to an approved production route family first, or deactivate the active SKUs through rpc_set_product_sku_active, then repeat the edit.';
  end if;
  -- remaining combinations (after unknown; or before unknown with after invalid): the impact cannot be proven safe -> REVIEW REQUIRED
  raise exception using
    errcode = 'P0001',
    message = format('WP10_PRODUCT_ROUTE_IMPACT_UNRESOLVED: the route impact of moving product %s to sub-group %s could not be determined (before=%s, after=%s) while %s active SKU(s) exist; review required.', new.id, new.sub_group_id, v_before, v_after, v_active),
    hint = 'Review the product''s route data (an ambiguous or unevaluable route, or a missing route family mapping) with the Production Route Manager owner, then repeat the edit. There is no override.';
end
$fn$;
revoke all on function public.fn_wp10_product_route_impact_before() from public, anon, authenticated;
revoke all on function public.fn_wp10_product_route_impact_after() from public, anon, authenticated;

create trigger trg_wp10_product_route_impact_before
  before update of sub_group_id on public.products
  for each row execute function public.fn_wp10_product_route_impact_before();
create trigger trg_wp10_product_route_impact_after
  after update of sub_group_id on public.products
  for each row execute function public.fn_wp10_product_route_impact_after();

-- RECEIPT (R5): stamps each created object with this file name and the md5 of its definition as created. 99_rollback_all.sql removes ONLY objects
-- whose receipt is present and whose definition still matches; anything changed or unowned makes the rollback fail closed without dropping anything.
do $wp10_receipt$
declare t text; v oid; r record;
begin
  foreach t in array array['public.fn_wp10_product_route_impact_before()', 'public.fn_wp10_product_route_impact_after()'] loop
    v := to_regprocedure(t);
    execute format('comment on function %s is %L', v::regprocedure, 'WP10-G2 05_product_route_impact_guard.sql md5:' || md5(pg_get_functiondef(v)));
  end loop;
  for r in select oid, tgname from pg_trigger where tgname = 'trg_wp10_product_route_impact_before' and tgrelid = 'public.products'::regclass and not tgisinternal loop
    execute format('comment on trigger %I on public.products is %L', r.tgname, 'WP10-G2 05_product_route_impact_guard.sql md5:' || md5(pg_get_triggerdef(r.oid)));
  end loop;
  for r in select oid, tgname from pg_trigger where tgname = 'trg_wp10_product_route_impact_after' and tgrelid = 'public.products'::regclass and not tgisinternal loop
    execute format('comment on trigger %I on public.products is %L', r.tgname, 'WP10-G2 05_product_route_impact_guard.sql md5:' || md5(pg_get_triggerdef(r.oid)));
  end loop;
end $wp10_receipt$;
commit;
