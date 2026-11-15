-- WP10 G2 ROLLBACK — UNAPPLIED. DO NOT RUN without separate, exact, owner-authorised operational approval.
-- Removes ONLY objects created by an application of proposals 01-05 that is still intact. No data is touched; no live-only function is altered.
--
-- PROVENANCE (R5): every object created by 01-05 carries a COMMENT receipt 'WP10-G2 <file> md5:<md5 of its definition as created>'.
--   Phase 1 verifies every object that EXISTS: receipt present, naming one of the five proposal files, and the current definition still matches the md5.
--   If any existing object has no receipt (not created by this procedure) or was modified since, the whole script raises and DROPS NOTHING.
--   Phase 2 drops, in dependency order, the objects that exist and passed. Objects that do not exist (a partially applied or already rolled-back
--   set) are skipped with a NOTICE; drop is without CASCADE, so an unexpected dependent object also aborts the script.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $wp10_rollback$
declare
  r record;
  v oid;
  c text;
  v_bad text[] := '{}';
  v_funcs text[] := array[
    'public.rpc_wp10_get_operational_expiry_horizon(integer, bigint, integer)',
    'public.fn_wp10_product_route_impact_after()',
    'public.fn_wp10_product_route_impact_before()',
    'public.fn_wp10_guard_active_sku_reparent()',
    'costing.fn_wp10_boundary_dates(bigint, bigint, date, date)',
    'costing.fn_wp10_essential_states_as_of(bigint, bigint, date)',
    'costing.fn_wp10_batch_size_state_as_of(bigint, date)',
    'costing.fn_wp10_today_ist()'];
  v_trg text[][] := array[
    array['trg_wp10_product_route_impact_after', 'public.products'],
    array['trg_wp10_product_route_impact_before', 'public.products'],
    array['trg_wp10_active_sku_reparent_guard', 'public.product_skus']];
  t text;
  i integer;
begin
  -- phase 1: verify provenance of everything that exists
  foreach t in array v_funcs loop
    v := to_regprocedure(t);
    if v is null then continue; end if;
    c := obj_description(v, 'pg_proc');
    if c is null or c !~ '^WP10-G2 0[1-5]_[a-z_]+\.sql md5:[0-9a-f]{32}$' or split_part(c, 'md5:', 2) <> md5(pg_get_functiondef(v)) then
      v_bad := v_bad || t;
    end if;
  end loop;
  for i in 1 .. array_length(v_trg, 1) loop
    for r in select oid, tgname from pg_trigger where tgname = v_trg[i][1] and tgrelid = v_trg[i][2]::regclass and not tgisinternal loop
      c := obj_description(r.oid, 'pg_trigger');
      if c is null or c !~ '^WP10-G2 0[1-5]_[a-z_]+\.sql md5:[0-9a-f]{32}$' or split_part(c, 'md5:', 2) <> md5(pg_get_triggerdef(r.oid)) then
        v_bad := v_bad || (v_trg[i][1] || ' on ' || v_trg[i][2]);
      end if;
    end loop;
  end loop;
  if array_length(v_bad, 1) > 0 then
    raise exception 'WP10-G2 rollback refused (nothing dropped): object(s) without an intact receipt - not created by this procedure or modified since: %', array_to_string(v_bad, ', ');
  end if;

  -- phase 2: drop what exists (triggers first, then functions in dependency order)
  for i in 1 .. array_length(v_trg, 1) loop
    if exists (select 1 from pg_trigger where tgname = v_trg[i][1] and tgrelid = v_trg[i][2]::regclass and not tgisinternal) then
      execute format('drop trigger %I on %s', v_trg[i][1], v_trg[i][2]);
    else
      raise notice 'WP10-G2 rollback: trigger % not present, skipped', v_trg[i][1];
    end if;
  end loop;
  foreach t in array v_funcs loop
    v := to_regprocedure(t);
    if v is null then raise notice 'WP10-G2 rollback: % not present, skipped', t; continue; end if;
    execute format('drop function %s', v::regprocedure);
  end loop;
end
$wp10_rollback$;
commit;
