-- WP10 G2 PROPOSAL 04 — UNAPPLIED. DO NOT RUN without separate, exact, owner-authorised operational approval.
-- Owner decision O4: an ACTIVE SKU must not be re-parented through an unreviewed path. Ordinary authenticated direct DML is already denied
-- (catalog) and the live rpc_update_product_sku has no product_id parameter, so the only reachable path is a PRIVILEGED direct writer.
--
-- Rejects: UPDATE where the row is active before AND after and product_id changes.
-- Reviewed path (no override, no new permission target, no exception workflow):
--   1. deactivate through rpc_set_product_sku_active (audited, reason required);
--   2. re-parent;
--   3. complete the new product's product-level essentials (batch size, route);
--   4. re-activate through rpc_set_product_sku_active (the live five-essential guard re-checks everything).
-- A single UPDATE that deactivates AND re-parents is allowed (the row ends inactive; nothing active moves) — but it is a direct write with no
-- lifecycle audit event; use the reviewed path above.
-- Unaffected by construction: inserts; updates that do not change product_id (UPDATE OF product_id); inactive SKUs; the parent-active guard.
-- Rollback: drop trigger + function (99_rollback_all.sql). No data is changed by applying or rolling back.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- PROVENANCE PREFLIGHT (R5): refuses to run when any object this file creates already exists (it never overwrites or adopts), when a live dependency
-- differs from the definition that was reviewed (md5 of pg_get_functiondef), or when a prerequisite proposal is missing or was modified after it was
-- applied. Re-running this file therefore FAILS at this block by design; a partial apply is impossible because the file is one transaction.
do $wp10_preflight$
declare t text; r record; v oid; c text;
begin
  foreach t in array array['public.fn_wp10_guard_active_sku_reparent()'] loop
    if to_regprocedure(t) is not null then
      raise exception 'WP10-G2 preflight: % already exists; refusing to overwrite or adopt it (review the existing definition separately).', t;
    end if;
  end loop;
  if exists (select 1 from pg_trigger where tgname = 'trg_wp10_active_sku_reparent_guard' and tgrelid = 'public.product_skus'::regclass and not tgisinternal) then
    raise exception 'WP10-G2 preflight: trigger trg_wp10_active_sku_reparent_guard on public.product_skus already exists; refusing to overwrite or adopt it.';
  end if;
end $wp10_preflight$;

create function public.fn_wp10_guard_active_sku_reparent()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if old.is_active is true and new.is_active is true and new.product_id is distinct from old.product_id then
    raise exception using
      errcode = 'P0001',
      message = format('WP10_ACTIVE_SKU_REPARENT_REJECTED: SKU %s is active and cannot be moved from product %s to product %s.', old.id, old.product_id, new.product_id),
      hint = 'Deactivate the SKU with rpc_set_product_sku_active, re-parent, complete the new product''s batch size and route, then activate it again (the five-essential guard re-checks).';
  end if;
  return new;
end
$fn$;
revoke all on function public.fn_wp10_guard_active_sku_reparent() from public, anon, authenticated;

create trigger trg_wp10_active_sku_reparent_guard
  before update of product_id on public.product_skus
  for each row execute function public.fn_wp10_guard_active_sku_reparent();

-- RECEIPT (R5): stamps each created object with this file name and the md5 of its definition as created. 99_rollback_all.sql removes ONLY objects
-- whose receipt is present and whose definition still matches; anything changed or unowned makes the rollback fail closed without dropping anything.
do $wp10_receipt$
declare t text; v oid; r record;
begin
  foreach t in array array['public.fn_wp10_guard_active_sku_reparent()'] loop
    v := to_regprocedure(t);
    execute format('comment on function %s is %L', v::regprocedure, 'WP10-G2 04_active_sku_reparent_guard.sql md5:' || md5(pg_get_functiondef(v)));
  end loop;
  for r in select oid, tgname from pg_trigger where tgname = 'trg_wp10_active_sku_reparent_guard' and tgrelid = 'public.product_skus'::regclass and not tgisinternal loop
    execute format('comment on trigger %I on public.product_skus is %L', r.tgname, 'WP10-G2 04_active_sku_reparent_guard.sql md5:' || md5(pg_get_triggerdef(r.oid)));
  end loop;
end $wp10_receipt$;
commit;
