-- WP10 G2 PROPOSAL 01 — UNAPPLIED. DO NOT RUN against any database without separate, exact, owner-authorised operational approval.
-- Lives outside supabase/migrations on purpose. Read-only helpers only: no table is created, altered or written.
--
-- (a) costing.fn_wp10_today_ist(): the ONE place the horizon reads the clock (so isolated tests can fix it).
-- (b) costing.fn_wp10_batch_size_state_as_of(product, date): the reviewed date-parameterised batch-size contract.
--     Predicate is IDENTICAL to the inline predicate in the live costing.fn_sku_activation_missing_items (live text, independent catalog):
--       exists(active row with effective_from <= date and (effective_to is null or effective_to >= date)).
--     The live helper, CI-038a as-of rule, LIVE_AS_OF, the fingerprint and the portfolio read are NOT changed or rewritten.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- PROVENANCE PREFLIGHT (R5): refuses to run when any object this file creates already exists (it never overwrites or adopts), when a live dependency
-- differs from the definition that was reviewed (md5 of pg_get_functiondef), or when a prerequisite proposal is missing or was modified after it was
-- applied. Re-running this file therefore FAILS at this block by design; a partial apply is impossible because the file is one transaction.
do $wp10_preflight$
declare t text; r record; v oid; c text;
begin
  foreach t in array array['costing.fn_wp10_today_ist()', 'costing.fn_wp10_batch_size_state_as_of(bigint, date)'] loop
    if to_regprocedure(t) is not null then
      raise exception 'WP10-G2 preflight: % already exists; refusing to overwrite or adopt it (review the existing definition separately).', t;
    end if;
  end loop;
  if to_regclass('public.production_batch_size_ref') is null then raise exception 'WP10-G2 preflight: required table public.production_batch_size_ref is missing.'; end if;
end $wp10_preflight$;

create function costing.fn_wp10_today_ist()
returns date
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $fn$ select (now() at time zone 'Asia/Kolkata')::date $fn$;

create function costing.fn_wp10_batch_size_state_as_of(p_product_id bigint, p_as_of date)
returns text
language sql
stable
security definer
set search_path = costing, public, pg_temp
as $fn$
  select case when exists (
    select 1 from public.production_batch_size_ref b
    where b.product_id = p_product_id
      and b.is_active
      and b.effective_from <= p_as_of
      and (b.effective_to is null or b.effective_to >= p_as_of)
  ) then 'RESOLVED' else 'MISSING' end
$fn$;

revoke all on function costing.fn_wp10_today_ist() from public, anon, authenticated;
revoke all on function costing.fn_wp10_batch_size_state_as_of(bigint, date) from public, anon, authenticated;

-- RECEIPT (R5): stamps each created object with this file name and the md5 of its definition as created. 99_rollback_all.sql removes ONLY objects
-- whose receipt is present and whose definition still matches; anything changed or unowned makes the rollback fail closed without dropping anything.
do $wp10_receipt$
declare t text; v oid; r record;
begin
  foreach t in array array['costing.fn_wp10_today_ist()', 'costing.fn_wp10_batch_size_state_as_of(bigint, date)'] loop
    v := to_regprocedure(t);
    execute format('comment on function %s is %L', v::regprocedure, 'WP10-G2 01_clock_and_batch_size_contract.sql md5:' || md5(pg_get_functiondef(v)));
  end loop;
end $wp10_receipt$;
commit;
